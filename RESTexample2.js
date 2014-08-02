/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs2');
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
        createActivity: appContext.createCommand('createActivity'),
        updateActivity: appContext.createCommand('updateActivity'),
        deleteActivity: appContext.createCommand('deleteActivity')
    };

    var domainEvents = {
        activityCreated: new EventHandler('activityCreated', commands.createActivity, function (activity) {
            // business logic
        }),
        activityUpdated: new EventHandler('activityUpdated', commands.updateActivity, function (activity) {
            // business logic
        }),
        activityDeleted: new EventHandler('activityDeleted', commands.deleteActivity, function (id) {
            // business logic
        })
    };

    // das hier ist quasi ein Aggregartor
    var projections = {
        allActivitiesProjection: new MongoProjection('allActivities', db, function (collection) {
            // handle thise events for projection:
            domainEvents.activityCreated.handle(function (activity) {
                collection('insert', activity);
            });

            domainEvents.activityUpdated.handle(function (activity) {
                collection('update', { _id: activity._id }, activity.activity);
            });

            domainEvents.activityDeleted.handle(function (id) {
                collection('remove', { _id: id._id });
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
            owner: {
                _id: "123",
                name: 'Jonathan inc.'
            },
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
        context.projections.allActivitiesProjection.query({}).then(function (activites) {
            res.json(activites);
        }).done();
    });
}).done();
//# sourceMappingURL=RESTexample2.js.map
