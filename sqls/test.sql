create table users
(fname varchar(25) not null,
 lname varchar(25) not null,
 usrname varchar(30) primary key not null,
 passhash varchar(90) not null,
 longitude float(10,6) not null,
 latitude float(10,6) not null);

insert into users values
('john', 'appleseed', 'japple', 'asdf', 12, 23);

create table usagerec
(usr varchar(30) not null,
 moment timestamp not null,
 kwhamount float(10,6) not null,
 foreign key (usr)
      references users(usrname)
      on update cascade
      on delete cascade);
