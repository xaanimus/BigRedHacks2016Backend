const mysql = require('mysql'),
      bcrypt = require('bcrypt');

const MYSQL_DB_HOST = process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
      MYSQL_DB_PORT = process.env.OPENSHIFT_MYSQL_DB_PORT || 8080,
      MYSQL_USER = process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
      MYSQL_PASS = process.env.OPENSHIFT_MYSQL_DB_PASSWORD,
      SALT = '$2a$10$SZL5SDwUbvXDdhM4kkfFNu';

function genSessionID() {
    return Math.floor(Math.random() * 1000000);
}

function findKeyOfValueInObject(obj, fn) {
    for (var k in obj) {
        if (fn(obj[k])) {
            return k;
        }
    }
    return null;
}

function Model() {
    let self = {};

    self.connection = mysql.createConnection({
        host    : MYSQL_DB_HOST,
        user    : MYSQL_USER,
        pass    : MYSQL_PASS,
        database: 'brh'
    });
    
    self.connection.connect();

    //self.sessions[sessionid] == null | username
    //session ids don't expire ... which isn't a good thing ... but this is a hackathon
    self.sessions = {};
    
    self.newUser = function(userinfo, cb) {
        bcrypt.hash(userinfo.password, SALT, hashcb);

        function hashcb(err, hash) {
            if (err != null) {
                cb(err);
                return;
            }

            let sql = "INSERT INTO users VALUES\n" +
                    "(?,?,?,?,?,?)";
            self.connection.query(sql,
                                  [userinfo.fname, userinfo.lname, userinfo.usrname,
                                   hash, userinfo.longitude,userinfo.latitude],
                                  sqlcb);
        };

        function sqlcb(err, results) {
            if (err != null) {
                cb(err);
                return;
            }

            cb(null, true);
        };
    };

    self.session = function(username, password, cb) {
        self.authenticate(username, password, (err, success) => {
            if (err != null || !success) {
                cb(err, null);
                return;
            }
            
            //check already existing session
            let key = findKeyOfValueInObject(self.sessions, v=>(v==username));

            if (key == null) {
                key = genSessionID();
                self.sessions[key] = username;
            }

            cb(null, key);
        });
    };

    self.authenticate = function(username,password,cb) {
        //gen hash
        bcrypt.hash(password, SALT, hashcb);
        
        //check db if username - hash OK
        function hashcb(err, hash) {
            if (err != null) {cb(err, false);return;}

            let sql = "SELECT passhash=?\n" +
                    "FROM users WHERE usrname=?";
            let fmtsql = self.connection.query(sql, [hash, username], sqlcb);
        }

        function sqlcb(err, results) {
            if (err != null) {
                cb(err, false);
                return;
            }

            
            for (var k in results[0]) {
                if (results[0][k] == 1) {
                    cb(null, true);
                } else {
                    cb(null, false);
                }
                break;
            }
        }
    };

    return self;
}

module.exports = Model;
