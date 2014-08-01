/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs');
var Command = cqrs.Command;
var DomainEvent = cqrs.DomainEvent;
var MongoProjection = cqrs.MongoProjection;



/////////////////////
// server
var initServer = function (db) {
    var commands = {
        createShoppingItem: new Command('createShoppingItem')
    };

    var domainEvents = {
        shoppingItemCreated: new DomainEvent('shoppingItemCreated', commands.createShoppingItem, function (item) {
            // business logic
        })
    };

    var projections = {
        specialOfferProjection: new MongoProjection('SpecialOffers', db, function (proj, collection) {
            // handle thise events for projection:
            domainEvents.shoppingItemCreated.handle(proj, function (item) {
                // do projection
                if (item.sale) {
                    collection('insert', {
                        name: item.name,
                        price: item.price
                    });
                }
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

    app.put('/createShoppingItem', function (req, res) {
        var params = req.body;

        context.commands.createShoppingItem.execute({
            name: params.name,
            price: params.price,
            sale: params.sale
        });

        res.send(200, { status: 'ok' });
    });

    app.get('/specialOffers', function (req, res) {
        context.projections.specialOfferProjection.query({}).then(function (proj) {
            res.json(proj);
        }).done();
    });
}).done();
//# sourceMappingURL=RESTexample.js.map
