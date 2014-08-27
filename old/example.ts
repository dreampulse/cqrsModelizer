/// <reference path="./../typings/tsd.d.ts"/>

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


import cqrs = require('./src/cqrs');
var Command = cqrs.Command;
var DomainEvent = cqrs.DomainEvent;
var MongoProjection = cqrs.MongoProjection;




////////////////////////////
////////// Domain Entities

interface Item {
  name : string;
  sale : boolean;
  price : number;
}


///////////////////////////
// Projections

interface SpecialOfferShoppingItems {
  name : string;
  price : number;
}

////////////////////////////
// Commands

var commands = {
  createShoppingItem : new Command<Item>('createShoppingItem')
};

/////////////////////
// server


var initServer = function(db: mongodb.Db) {

  var domainEvents = {
    shoppingItemCreated : new DomainEvent<Item>('shoppingItemCreated', commands.createShoppingItem, (item) => {
      // business logic

    })

  };

  var projections = {
    SpecialOfferProjection: new MongoProjection<SpecialOfferShoppingItems>('SpecialOffers', db, (proj, collection) => {

      // handle thise events for projection:
      domainEvents.shoppingItemCreated.handle(proj, (item:Item) => {
        // do projection

        if (item.sale) {  // only if item is on sale
          collection('insert', {
            name: item.name,
            price: item.price
          });
        }
      })

    })
  };

};




// running

// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs')
  .then((db : mongodb.Db) => {

    initServer(db);


    // do stuff (run commands)

    commands.createShoppingItem.execute({
      name: 'MacPro',
      price: 100,
      sale: true
    });


    return db;
  })
  .then((db : mongodb.Db) => {  // clean up
    db.close();
  }).done();
