create table users
(fname varchar(25) not null,
 lname varchar(25) not null,
 usrname varchar(30) primary key not null,
 passhash varchar(90) not null,
 longitude float(10,6) not null,
 latitude float(10,6) not null,
 capitalOneId varchar(30));

create table usagerec
(usr varchar(30) not null,
 moment timestamp not null,
 kwhamount float(10,6) not null,
 foreign key (usr)
      references users(usrname)
      on update cascade
      on delete cascade);

CREATE TRIGGER check_usage_rec BEFORE INSERT ON usagerec
FOR EACH ROW
BEGIN
IF EXISTS
(
        SELECT *
        FROM usagerec U
        WHERE (U.usr=NEW.usr AND U.moment=NEW.moment)
) THEN
        SIGNAL sqlstate '45000';
END IF;
END;

CREATE TRIGGER check_usage_rec BEFORE INSERT ON usagerec
FOR EACH ROW
BEGIN
IF (TRUE) THEN
          SET NEW = NULL;
END IF;
END;

SELECT * FROM usagerec
WHERE moment > CURRENT_TIMESTAMP - INTERVAL 1 WEEK;

SELECT MIN(kwhamount), MAX(kwhamount)
                    FROM usagerec
                    WHERE moment > CURRENT_TIMESTAMP - INTERVAL 1 WEEK
                    GROUP BY usr;
