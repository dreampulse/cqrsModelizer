/// <reference path="./../typings/tsd.d.ts"/>
var assert = require('assert');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('../src/old/cqrs3');
var Command = cqrs.Command;
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;
var DomainEvent = cqrs.DomainEvent;



/////////////////////
// server
var initServer = function (db) {
    var domainEvents = {
        userRegistered: new DomainEvent('userRegistered', 'appContext', db),
        userLoggedIn: new DomainEvent('userLoggedIn', 'appContext', db),
        userEdited: new DomainEvent('userEdited', 'appContext', db),
        userRemoved: new DomainEvent('userRemoved', 'appContext', db)
    };

    var projections = {
        usersProjection: new MongoProjection('users', db, function (collection) {
            // handle thise events for projection:
            domainEvents.userRegistered.handle(function (user) {
                var doc = {
                    _id: new mongodb.ObjectID(),
                    email: user.email,
                    name: user.name,
                    password: user.password
                };
                collection.insert(doc);
            });

            domainEvents.userEdited.handle(function (updatedUser) {
                collection.update({ _id: updatedUser._id }, updatedUser);
            });

            domainEvents.userRemoved.handle(function (id) {
                collection.remove(id);
            });
        })
    };

    return {
        domainEvents: domainEvents,
        projections: projections
    };
};

// running
var app = express();
app.set('json spaces', '  ');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(session({ secret: 'bak-gAt-arC-eF', resave: true, saveUninitialized: true }));

// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs').then(function (db) {
    var context = initServer(db);

    app.listen(3000, function () {
        console.info('Server is running!');
    });

    // Command: Register User
    app.put('/user', function (req, res) {
        var params = req.body;

        context.projections.usersProjection.query({ email: params.email }).then(function (users) {
            assert(users.length < 1, "User already registered");

            context.domainEvents.userRegistered.emit(params);
            res.json({ 'ok': true });
        }).fail(function (err) {
            res.json(500, { 'ok': false, 'err': err });
        });
    });

    // Command: Login
    app.post('/user/login', function (req, res) {
        var params = req.body;

        context.projections.usersProjection.query({ email: params.email }).then(function (users) {
            if (users.length > 1) {
                throw new Error("That shout not happen");
            }
            if (users.length < 1) {
                throw new Error("User not found");
            }
            if (users.length == 1) {
                if (users[0].password !== params.password) {
                    throw new Error("Wrong password");
                } else {
                    req.session.user = users[0];
                    context.domainEvents.userLoggedIn.emit({});
                    res.json({ 'ok': true });
                }
            }
        }).fail(function (err) {
            res.json(500, { 'ok': false, 'err': err });
        });
    });

    // Command: Edit User
    app.post('/user', function (req, res) {
        var params = req.body;
        if (req.session.user) {
            context.projections.usersProjection.query({ _id: req.session.user._id }).then(function (users) {
                assert(users.length == 1, "User not found");

                var doc = params;
                doc._id = req.session.user._id;

                context.domainEvents.userEdited.emit(doc);
            }).fail(function (err) {
                res.json(500, { 'ok': false, 'err': err });
            });
        } else {
            res.json(401, { 'ok': false, 'err': 'not logged in' });
        }
    });

    // Command: Delete User
    app.delete('/user', function (req, res) {
        if (req.session.user) {
            context.domainEvents.userRemoved.emit(req.session.user._id);
            delete req.session.user;
        }
    });

    app.put('/activity', function (req, res) {
    });

    app.get('/activites', function (req, res) {
    });
}).done();
//# sourceMappingURL=RESTexample3.js.map
