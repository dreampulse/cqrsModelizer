/// <reference path="./typings/tsd.d.ts"/>
var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs');
var Command = cqrs.Command;
var DomainEvent = cqrs.DomainEvent;
var MongoProjection = cqrs.MongoProjection;



////////////////////////////
// Commands
var commands = {
    createShoppingItem: new Command('createShoppingItem')
};

/////////////////////
// server
var initServer = function (db) {
    var domainEvents = {
        shoppingItemCreated: new DomainEvent('shoppingItemCreated', commands.createShoppingItem, function (item) {
            // business logic
        })
    };

    var projections = {
        fooProjection: new MongoProjection('foo', db, function (proj, collection) {
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
};

// running
// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs').then(function (db) {
    initServer(db);

    // do stuff (run commands)
    commands.createShoppingItem.execute({
        name: 'MacPro',
        price: 100,
        sale: true
    });

    return db;
}).then(function (db) {
    db.close();
}).done();
//# sourceMappingURL=example.js.map
