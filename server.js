"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const passport = require("passport");
const session = require("express-session");
const mongo = require("mongodb").MongoClient;
const LocalStrategy = require("passport-local");
const ObjectID = require("mongodb").ObjectID;
// const bcrypt = require('bcrypt');

const app = express();

fccTesting(app);
app.use("/public", express.static(process.cwd() + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "pug");

//Database connect
mongo.connect(process.env.DATABASE, (err, db) => {
  if (err) {
    console.log(`Database error: ${err}`);
  } else {
    console.log("Succesful database connection");
    passport.use(
      new LocalStrategy((username, password, done) => {
        db.collection("users").findOne({ username: username }, (err, user) => {
          console.log(`User ${username} attempted to log in.`);
          if (err) {
            done(err);
          }
          if (!user) {
            done(null, false);
          }
//           Hashing
          // if (!bcrypt.compareSync(password, user.password)) {
          //   return done(null, false);
          // }
//           End
          if (password !== user.password) {
            done(null, false);
          }
          done(null, user);
        });
      })
    );
    passport.serializeUser((user, done) => {
      done(null, user._id);
    });

    passport.deserializeUser((id, done) => {
      db.collection("users").findOne(
        {
          _id: new ObjectID(id)
        },
        (err, doc) => {
          done(null, doc);
        }
      );
    });
    
    function ensureAuthenticated(req, res, next) {
      if (req.isAuthenticated()) {
        next();
      }
      res.redirect("/");
    }
    
    app.route("/register").post(
      (req, res, next) => {
        db.collection("users").findOne(
          { username: req.body.username },
          function(err, user) {
            if (err) {
              next(err);
            } else if (user) {
              res.redirect("/");
            } else {
              // const hash = bcrypt.hashSync(req.body.password, 12);
              db.collection("users").insertOne(
                {
                  username: req.body.username,
                  //Hash
                  // password: hash
                  password: req.body.password
                },
                (err, doc) => {
                  if (err) {
                    res.redirect("/");
                  } else {
                    next(null, user);
                  }
                }
              );
            }
          }
        );
      },
      passport.authenticate("local", { failureRedirect: "/" }),
      (req, res, next) => {
        res.redirect("/profile");
      }
    );
    app
      .route("/login")
      .post(
        passport.authenticate("local", { failureRedirect: "/" }),
        (req, res) => {
          res.redirect("/profile");
          console.log(`User ${req.user} attempted to log in.`);
        }
      );

    app.route("/logout").get((req, res) => {
      req.logout();
      req.session;
      res.redirect("/");
    });

    app.route("/profile").get(ensureAuthenticated, (req, res) =>
      res.render(process.cwd() + "/views/pug/profile.pug", {
        username: req.user.username
      })
    );

    app.route("/").get((req, res) => {
      res.render(process.cwd() + "/views/pug/index.pug", {
        title: "Home Page",
        message: "Please login",
        showLogin: true,
        showRegistration: true
      });
    });

    app.use((req, res, next) => {
      res
        .status(404)
        .type("text")
        .send("Not Found");
    });
    app.listen(process.env.PORT || 3000, () => {
      console.log("Listening on port " + process.env.PORT);
    });
  }
});
