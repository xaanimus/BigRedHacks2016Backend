const bodyParser = require('body-parser');

const ER_DUP_ENTRY_CODE = 'ER_DUP_ENTRY';

var router = require('express').Router(),
    model  = require('./model.js')();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended:true}));

router.post("/user/new", (req, res) => {
    let usrinfo = req.body;

    model.newUser(usrinfo, (err, success) => {
        if (err != null) {
            console.log(err);
            //duplicate username
            if (err.code == ER_DUP_ENTRY_CODE) {
                res.json({
                    ok: false,
                    code: "DUPLUSR",
                    why: "username taken"
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
            res.json({ok:false});
            console.log(err);
        } else {
            res.json({ok:true, key:key});
        }
    });
});

router.post("/usage", (req, res) => {
    let sid = req.body.sid;
    let moment = req.body.moment;
    let kwhamt = req.body.kwhamount;

    model.postUsage(sid, moment, kwhamt, (err) => {
        if (err) {
            res.json({ok:false});
            return;
        }
        res.json({ok:true});
    });
});

router.post("/moneyspent/last6weeks", (req,res) => {
    let sid = req.body.sid;
    model.getMoneySpentLastSixWeeks(sid, (err, result) => {
        if (err) {
            console.log(err);
            res.json({ok:false});
            return;
        }
        res.json({ok:false, content:result});
    });
});


router.post("/moneyspent/lastweek", (req,res) => {
    let sid = req.body.sid;
    model.getMoneySpentLastWeek(sid, (err, dollars)=>{
        if (err) {
            console.log(err);
            res.send({ok:false});
            return;
        }
        res.send({ok:true, dollars:dollars});
    });
});

//barely tested
router.post("/moneyspent/compared", (req,res) => {
    let sid = req.body.sid;
    model.getMoneySpentComparedToOthersLastWeek(sid, (err, dollars)=>{
        if (err) {
            console.log(err);
            res.json({ok:false});
            return;
        }
        res.send({ok:true, dollars:dollars});
    });
});


router.post("/user/top", (req, res) => {
    let sid = req.body.sid;
    model.getTopFiveUsers(sid, (err, users)=>{
        if (err) {
            console.log(err);
            res.json({ok:false});
            return;
        }
        res.json({ok:true, users:users});
    });
});

router.post("/rewards", (req, res) => {
    let sid = req.body.sid;
    model.getRewards(sid, (err, rewards)=>{
        if (err) {
            console.log(err);
            res.send("no");
            return;
        }
        res.json({ok:true, rewards:rewards});
    });
});



module.exports = function(app) {
    app.use(router);
};
