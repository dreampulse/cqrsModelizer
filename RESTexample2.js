/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
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



/////////////////////
// server
var initServer = function (db) {
    var appContext = new Context('appContext', db);

    var commands = {
        createActivity: new StoredEventProvider('createActivity', 'appContext', db),
        updateActivity: appContext.createCommand('updateActivity'),
        deleteActivity: appContext.createCommand('deleteActivity'),
        createUser: appContext.createCommand('createUser'),
        updateUser: appContext.createCommand('updateUser'),
        deleteUser: appContext.createCommand('deleteUser')
    };

    var domainEvents = {
        activityCreated: new EventHandler('activityCreated', commands.createActivity, function (activity) {
            // business logic
        }),
        activityUpdated: new EventHandler('activityUpdated', commands.updateActivity, function (update) {
            // business logic
        }),
        activityDeleted: new EventHandler('activityDeleted', commands.deleteActivity, function (id) {
            // business logic
        }),
        userCreated: new EventHandler('userCreated', commands.createUser, function (user) {
            // business logic
        }),
        userUpdated: new EventHandler('userUpdated', commands.updateUser, function (update) {
            // business logic
        }),
        userDeleted: new EventHandler('userDeleted', commands.deleteUser, function (id) {
            // business logic
        })
    };

    // das hier ist quasi ein Aggregartor
    var projections = {
        activitiesProjection: new MongoProjection('activities', db, function (collection) {
            // handle thise events for projection:
            domainEvents.activityCreated.handle(function (activity) {
                var activityProjection = activity;
                activityProjection._id = new mongodb.ObjectID();
                activityProjection.owner = {
                    _id: new mongodb.ObjectID(),
                    name: 'jonathan'
                };
                collection.insert(activityProjection);
            });

            domainEvents.activityUpdated.handle(function (activity) {
                collection.execute('update', { _id: activity._id }, activity.object);
            });

            domainEvents.activityDeleted.handle(function (id) {
                collection.execute('remove', { _id: id._id });
            });

            // user Handling
            domainEvents.userUpdated.handle(function (update) {
                // update name
                collection.execute('update', { 'owner._id': update._id }, {
                    '$set': { 'owner.name': update.object.name }
                });
            });

            domainEvents.userDeleted.handle(function (update) {
                // also delete activity
                collection.execute('remove', { 'owner._id': update._id });
            });
        }),
        usersProjection: new MongoProjection('users', db, function (collection) {
            // handle thise events for projection:
            domainEvents.userCreated.handle(function (user) {
                var userProjection = user;
                userProjection._id = new mongodb.ObjectID();
                collection.insert(userProjection);
            });

            domainEvents.userUpdated.handle(function (update) {
                collection.execute('update', { _id: update._id }, update.object);
            });

            domainEvents.userDeleted.handle(function (id) {
                collection.execute('remove', { _id: id._id });
            });
        })
    };

    return {
        domainEvents: domainEvents,
        projections: projections,
        commands: commands
    };
};

// running
var app = express();
app.use(bodyParser.json());

// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs').then(function (db) {
    var context = initServer(db);

    app.listen(9000, function () {
        console.info('Server is running!');
    });

    app.put('/activity', function (req, res) {
        var params = req.body;

        context.commands.createActivity.emit({
            desc: 'Epic Fun',
            items: [{
                    name: 'Nabada',
                    price: 0,
                    quantity: 10000
                }]
        });

        res.send({ status: 'ok' });
    });

    app.get('/activites', function (req, res) {
        context.projections.activitiesProjection.query({}).then(function (activites) {
            res.json(activites);
        }).done();
    });
}).done();
//# sourceMappingURL=RESTexample2.js.map
