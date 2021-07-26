const express = require('express');
const AWS = require('aws-sdk');
AWS.config.update({
	accessKeyId: 'ASIAZ5ZCEM4XIAYDY26G',
	secretAccessKey: '8nHfHW/wpPrEMnJHaZwyZpIGKVSRxKgun3qe5M+U',
	sessionToken: 'FwoGZXIvYXdzEPH//////////wEaDBAfJYJgAXdzG4LRxCLWAaEWDF2MhgXO4eHmBdgvloUy8tQ3AzV7QLNoFC7ddH628HfJzDa5lt04Q27PTGDRUbtL+D3G7kUY2stfF4fcRXHKv8XZsHuWCIwU3I5oMCii9iAiekofEMXd9IoUr+vRWwNmY4A93445uXhdvGjRER92EaExVoqyMcjNDHG/LN2AMdozBNGg1equ8BlS23WPuDdmmiCZXzsDzEuE5yUIMZrv7qifVfdg8/FrueqYqSYb1/f9HB+txOgCNPinYFGTWW+eEo+Fk+7NBzNHqoKWeauMEX8LSWoo5MTY/QUyLcw42oSXBpAmQbbJXOngT2WcrZeI9u0nouQoZUk2n0UsA1sj3BEgT44iucW1ug==',
	region: 'us-east-1'
});
const app = express();
const mysql = require('mysql');
const multer = require('multer');
var upload = multer({ storage: multer.memoryStorage() });
var s3bucket = new AWS.S3();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');

const connection = mysql.createConnection({
	host: "animaldb.coa8snnmkbvg.us-east-1.rds.amazonaws.com",
	user: "admin",
	password: "animal2020",
	port: "3306",
	database: "animaldb"
});

connection.connect(function (err) {
	if (err) throw err;
	console.log("AWS-RDS database Connected");
});

function isNaturalNumber(n) {
	n = n.toString();
	var n1 = Math.abs(n),
		n2 = parseInt(n, 10);
	return !isNaN(n1) && n2 === n1 && n1.toString() === n;
}

app.post('/addanimal', upload.single('animalPhoto'), (req, res) => {

	let animalName = req.param('animalName');
	let species = req.param('species');
	let count = req.param('count');
	let description = req.param('description');
	var animalPhoto = req.file.buffer.toString('base64');
	animalPhoto = Buffer.from(animalPhoto.replace(/^data:image\/\w+;base64,/, ''), 'base64');

	if (animalName.length > 50) {
		return res.end('Animal name must have length <= 50!');
	}
	if (species.length > 50) {
		return res.end('Species must have <= 50 characters');
	}
	if (!isNaturalNumber(count) || count > 10000) {
		return res.end('Count must be a natural number and <=10000');
	}
	if (description.length > 200) {
		return res.end('Description must have <= 200 characters');
	}
	connection.query(`insert into animal values ('${animalName}','${species}','${count}','${description}')`, function (err, result) {
		if (err) {
			if(err.code=== 'ER_DUP_ENTRY')
			res.end('Error: Animal already exists!');
			else
			res.end('Error Occurred! please check values');
			return
		}
		var params = {
			Bucket: 'kishananimalbucket',
			Key: `${animalName}.jpg`,
			Body: animalPhoto,
			ContentEncoding: 'base64',
			ContentType: 'image/jpeg',
			ACL: 'public-read'
		};
		s3bucket.putObject(params, function (err, data) {
			if (err) {
				console.log(err);
				return res.end("Animal Details Stored. Error storing picture");
			}
			else {
				return res.end("Successfully stored animal details!");
			}
		});
	});
});

app.get('/allanimals', function (req, res) {
	connection.query(`select * from animal order by animalName`, function (err, result) {
		if (err) {
			res.send('Error Occurred!');
			throw err;
		}
		res.render('AllAnimals', { animals: result });
	});
});

app.post('/animaldetails', function (req, res) {
	let animalName = req.param('animalName');

	connection.query(`select * from animal where animalName like '${animalName}'`, function (err, result) {
		if (err) {
			res.send('Error Occurred!');
			throw err;
		}
		if (result.length === 0) {
			return res.end('Animal not found');
		}
		res.render('AnimalDetails', { animal: result[0] });
	});
});

app.get('/pictures/:name', function (req, res) {
	let animalName = req.param('name');
	params = { Bucket: 'kishananimalbucket', Key: animalName + '.jpg', ResponseContentType: 'application/jpg' };
	s3bucket.getObject(params, function (err, data) {
		if (err) {
			return res.end("Error retrieving picture ", err);
		}
		else {
			const picture = 'data:image/jpeg;base64,' + Buffer.from(data.Body).toString('base64');
			res.end(`<h1>${animalName}</h1><img src="${picture}"></img>`);
		}
	});

});

app.post('/updatecount', function (req, res) {
	let animalName = req.param('animalName');
	let newCount = req.param('newCount');
	if (!isNaturalNumber(newCount))
		return res.end('count must be a natural number');

	connection.query(`update animal set count=${newCount} where animalName like '${animalName}'`, function (err, result) {
		if (err) {
			res.send('Error Occurred!');
			throw err;
		}
		if (result.affectedRows === 0)
			res.end('No animal found with given name');
		else
			res.end('Count updated successfully!');
	});
});

app.post('/deleteanimal', function (req, res) {
	let animalName = req.param('animalName');
	connection.query(`delete from animal where animalName like '${animalName}'`, function (err, result) {
		if (err) {
			res.send('Error Occurred!');
			throw err;
		}
		if (result.affectedRows === 0)
			res.end('No animal found with given name');
		else {
			let params = { Bucket: 'kishananimalbucket', Key: animalName + '.jpg' };
			s3bucket.deleteObject(params, function (err, data) {
				if (err)
					res.end('Error deleting image from s3 & rest of the details deleted succesfully');
				else
					res.end('Animal Details Deleted successfully!');
			});
		}
	});
});

app.listen(3000);