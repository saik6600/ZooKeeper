use animaldb;

create table animal(
animalName varchar(50) primary key,
species varchar(50),
count numeric(5),
description varchar(200)
);

insert into animal values('tiger','cat','1','Our National animal');

select * from animal;