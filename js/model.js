const mysql = require('mysql'),
      hash = require('node_hash'),
      request = require('request');

const MYSQL_DB_HOST = process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
      MYSQL_DB_PORT = process.env.OPENSHIFT_MYSQL_DB_PORT || 8080,
      MYSQL_USER = process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
      MYSQL_PASS = process.env.OPENSHIFT_MYSQL_DB_PASSWORD,
      SALT = '$2a$10$SZL5SDwUbvXDdhM4kkfFNu',
      DOLLAR_PER_KHW = 0.12;

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

function isEmptyString(a) {
    return a == null ||
        a.length == null ||
        a.length == 0;
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
        if (isEmptyString(userinfo.streetnum ) ||
            isEmptyString(userinfo.streetname) ||
            isEmptyString(userinfo.city) ||
            isEmptyString(userinfo.state) ||
            isEmptyString(userinfo.zip)) {
            cb(new Error("missing address!"));
            return;
        }
            
        let h = hash.md5(userinfo.password, SALT);
        
        let sql = "INSERT INTO users VALUES\n" +
                "(?,?,?,?,?,?,NULL)";
        self.connection.query(sql,
                              [userinfo.fname, userinfo.lname, userinfo.usrname,
                               h, userinfo.longitude,userinfo.latitude],
                              sqlcb);

        function sqlcb(err, results) {
            if (err != null) {
                cb(err);
                return;
            }

            cb(null, true);
            capitalOneInitCb();
        };

        function capitalOneInitCb() {
            let zip = "" + userinfo.zip;
            var options = {};
            options.method = 'POST';
            options.url = 'http://api.reimaginebanking.com/customers';
            options.qs = { key: '0f426456b1a8b556fbcbdd446ba29f0b' };
            options.headers = {
                'content-type': 'application/json'
            };
            options.body = {
                first_name: userinfo.fname,
                last_name: userinfo.lname,
                address: {
                    street_number: userinfo.streetnum,
                    street_name: userinfo.streetname,
                    city: userinfo.city,
                    state: userinfo.state,
                    zip: zip
                }
            };
            options.json = true;
            
            request(options, function (error, response, body) {
                if (error) throw new Error(error);
                let obj = body; //JSON.parse(body);
                if (obj == null ||
                    obj.objectCreated == null ||
                    obj.objectCreated._id == null)
                {
                    return;
                }
                
                let sql = "UPDATE users\n" +
                        "SET capitalOneID=?\n" +
                        "WHERE usrname=?";
                self.connection.query(sql,
                                      [obj.objectCreated._id, userinfo.usrname],
                                      (err, rows)=>{
                                          if (err){
                                              console.log("error with capital one user");
                                              return;
                                          }
                                      });
                
                //MAKE ACCOUNT ================
                let accountOpt = {};
                accountOpt.method = "POST";
                accountOpt.url = 'http://api.reimaginebanking.com/customers/'+
                    obj.objectCreated._id+"/accounts";
                accountOpt.qs = { key: '0f426456b1a8b556fbcbdd446ba29f0b' };
                accountOpt.headers = {
                    "content-type" : "application/json"
                };
                accountOpt.body = {
                    type: "Credit Card",
                    nickname: "credit",
                    rewards: 0,
                    balance: 0
                };
                accountOpt.json = true;
                
                request(accountOpt, function(error, response, body){
                    if (error) {console.log("err with requests");return;}
                    console.log("res");
                    console.log(body);
                });
                
            });
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
        let h = hash.md5(password, SALT);
        
        //check db if username - hash OK
        let sql = "SELECT passhash=?\n" +
                "FROM users WHERE usrname=?";
        let fmtsql = self.connection.query(sql, [h, username], sqlcb);

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

    self.postUsage = function(sessionid, moment, kwhamount, cb) {
        //check valid session id
        let username = self.sessions[sessionid];
        if (username == null) {
            cb(new Error("improper session id"));
            return;
        }
        
        //try insert usage into db
        let sql = "INSERT INTO usagerec VALUES\n" +
                "(?, ?, ?)";
        self.connection.query(sql, [username, moment, kwhamount], (err, rows) => {
            if (err) {cb(err); return;}
            cb(null);
        });
    };

    self.getMoneySpentLastSixWeeks = function(sid, cb) {
        //check valid session id
        let username = self.sessions[sid];
        if (username == null) {
            cb(new Error("improper session id"));
            return;
        }

        let sql = "SELECT * FROM usagerec\n" +
                "WHERE moment > CURRENT_TIMESTAMP - INTERVAL 6 WEEK AND\n" +
                "usr=?\n" +
                "ORDER BY moment ASC";
        self.connection.query(sql, [username], (err, rows) => {
            if (err) {cb(err); return;}
            let result = [];
            for(var i = 1; i < rows.length; i++) {
                let kwhdiff = rows[i]["kwhamount"] - rows[i-1]["kwhamount"];
                let dollardiff = kwhdiff * DOLLAR_PER_KHW;
                result.push({date: rows[i]["moment"], dollar: dollardiff});
            }
            cb(null, result);
        });
    };

    self.getMoneySpentLastWeek = function(sid, cb) {
        //check valid session id
        let username = self.sessions[sid];
        if (username == null) {
            cb(new Error("improper session id"));
            return;
        }

        let sql = "SELECT MAX(moment) AS mmax, MIN(moment) AS mmin FROM usagerec\n" +
                "WHERE moment > CURRENT_TIMESTAMP - INTERVAL 1 WEEK AND\n" +
                "usr=?";
        self.connection.query(sql, [username], (err, rows) => {
            if (err) {cb(err); return;}
            let mmin = rows[0]["mmin"];
            let mmax = rows[0]["mmax"];
            if (mmin == null || mmax == null) {cb(new Error("mmin mmax undef"));return;}
            let sqlForDiff = "SELECT kwhamount FROM usagerec\n" +
                    "WHERE moment=?\n" +
                    "UNION\n" +
                    "SELECT kwhamount FROM usagerec\n" +
                    "WHERE moment=?\n";
            self.connection.query(sqlForDiff, [mmax, mmin], (err, rows) => {
                if(err){
                    cb(err);return;
                }
                let kwhdiff = rows[0]["kwhamount"] - rows[1]["kwhamount"];
                kwhdiff = Math.abs(kwhdiff);
                let moneyDiff = kwhdiff * DOLLAR_PER_KHW;
                cb(null, moneyDiff);
            });
        });
    };


    self.getMoneySpentComparedToOthersLastWeek = function(sid, cb) {
        let username = self.sessions[sid];
        if (username == null) {
            cb(new Error("improper session id"));
            return;
        }
        
        self.getMoneySpentLastWeek(sid, (err, dollars) => {
            let sql = "SELECT MIN(kwhamount) as mink, MAX(kwhamount) as maxk\n" +
                    "FROM usagerec\n" +
                    "WHERE moment > CURRENT_TIMESTAMP - INTERVAL 1 WEEK\n" +
                    "GROUP BY usr"; 
            self.connection.query(sql, (err, rows) => {
                if(err){cb(err);return;}
                let sum = 0;
                for(var i = 0; i < rows.length; i++) {
                    let kwhdiff = rows[i]["maxk"] - rows[i]["mink"];
                    let dollardiff = kwhdiff * DOLLAR_PER_KHW;
                    sum += dollardiff;
                }
                let avg = sum / rows.length;
                cb(null, dollars - avg);
            });
        });
    };

    //IF SORT DOESN'T WORK, LOOK HERE (rows.sort)
    self.getTopFiveUsers = function(sid, cb) {
        let sql = "SELECT usr, ((MAX(kwhamount) - MIN(kwhamount))*?) AS money\n" +
                "FROM usagerec\n" +
                "WHERE moment > CURRENT_TIMESTAMP - INTERVAL 1 WEEK\n" +
                "GROUP BY usr\n";
        self.connection.query(sql, [DOLLAR_PER_KHW], (err, rows) => {
            if (err) {cb(err);return;}
            rows.sort((a,b)=>(b["money"] - a["money"]));
            let result = rows.slice(0,5);
            cb(null, result);
        });
    };

    self.getRewards = function(sid, cb) {
        let username = self.sessions[sid];
        if (username == null) {
            cb(new Error("improper session id"));
            return;
        }

        let sql = "SELECT capitalOneId FROM users\n" +
                "WHERE usrname=?";
        self.connection.query(sql, [username], (err, rows) => {
            if (err) {cb(err);return;}
            let capitalId = rows[0]["capitalOneId"];

            let ops = {};
            ops.method = "GET";
            ops.url = 'http://api.reimaginebanking.com/customers/'+
                capitalId+"/accounts";
            ops.qs = { key: '0f426456b1a8b556fbcbdd446ba29f0b' };
            
            request(ops, function(error, response, body){
                if (error) {console.log("err");return;}
                body = JSON.parse(body);
                console.log("=============");
                console.log(body);
                console.log("=============");
                console.log(body == null, body.length == null
                            , body.length == 0 ,body[0].rewards == null);
                if (body == null || body.length == null
                    || body.length == 0 || body[0].rewards == null)
                {
                    cb(new Error("error getting rewards"));
                    return;
                }
                
                cb(null, {rewards:body[0].rewards});
            });
        });
    };

    return self;
}

module.exports = Model;
