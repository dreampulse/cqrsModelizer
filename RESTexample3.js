/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs3');
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
    var appContext = new Context('appContext', db);

    var domainEvents = {
        userRegistered: new DomainEvent('userRegistered'),
        userLoggedIn: new DomainEvent('userLoggedIn'),
        userEdited: new DomainEvent('userEdited'),
        userRemoved: new DomainEvent('userRemoved')
    };

    // das hier ist quasi ein Aggregartor
    var projections = {
        usersProjection: new MongoProjection('users', db, function (collection) {
            // handle thise events for projection:
            domainEvents.userRegistered.handle(function (user) {
                var userProjection = {
                    _id: new mongodb.ObjectID(),
                    email: user.email,
                    name: user.name,
                    password: user.password
                };
                collection.insert(userProjection);
            });

            domainEvents.userEdited.handle(function (updatedUser) {
                projections.usersProjection.query({ _id: updatedUser._id }).then(function (users) {
                    //assert(users.length == 1);
                    collection.execute('update', { _id: updatedUser._id }, updatedUser.object);
                });
            });

            domainEvents.userRemoved.handle(function (id) {
                collection.execute('remove', { _id: id });
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
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(session({ secret: 'bak-gAt-arC-eF' }));

// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs').then(function (db) {
    var context = initServer(db);

    app.listen(3000, function () {
        console.info('Server is running!');
    });

    app.put('/user', function (req, res) {
        var params = req.body;

        context.domainEvents.userRegistered.emit(params);

        res.json({ 'ok': true });
    });

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
        }).done();
    });

    app.post('/user', function (req, res) {
        var params = req.body;
        if (req.session.user) {
            var update = {
                _id: req.session.user._id,
                object: params
            };
            context.domainEvents.userEdited.emit(update);
        }
    });

    app.delete('/user', function (req, res) {
        if (req.session.user) {
            context.domainEvents.userRemoved.emit(req.session.user._id);
        }
    });

    app.put('/activity', function (req, res) {
    });

    app.get('/activites', function (req, res) {
    });
}).done();
//# sourceMappingURL=RESTexample3.js.map
