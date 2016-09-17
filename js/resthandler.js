const bodyParser = require('body-parser');

const ER_DUP_ENTRY_CODE = 'ER_DUP_ENTRY';

var router = require('express').Router(),
    model  = require('./model.js')();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended:true}));

router.post("/user/new", (req, res) => {
    let usrinfo = {
        fname    : req.body.fname,
        lname    : req.body.lname,
        usrname  : req.body.usrname,
        password : req.body.password,
        longitude: req.body.longitude,
        latitude : req.body.latitude
    };

    model.newUser(usrinfo, (err, success) => {
        if (err != null) {
            //duplicate username
            if (err.code == ER_DUP_ENTRY_CODE) {
                res.json({
                    ok: false,
                    code: "DUPLUSR"
                });
            } else {
                res.json({
                    ok: false,
                    code: ""
                });
            }
        } else {   
            res.json({
                ok: true
            });
        }
    });
});

router.post("/login/new", (req, res) => {
    let usr = req.body.usrname;
    let pass = req.body.password;

    model.session(usr, pass, (err, key) => {
        if (key == null) {
            res.send("err");
            console.log(err);
        } else {
            res.send("" + key);
        }
    });
});

module.exports = function(app) {
    app.use(router);
};
