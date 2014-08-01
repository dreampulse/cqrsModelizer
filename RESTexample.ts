/// <reference path="./typings/tsd.d.ts"/>

import express = require('express');
import bodyParser = require('body-parser');
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

interface SpecialOfferShoppingItem {
  name : string;
  price : number;
}


/////////////////////
// server


var initServer = function (db:mongodb.Db) {

  var commands = {
    createShoppingItem: new Command<Item>('createShoppingItem')
  };


  var domainEvents = {
    shoppingItemCreated: new DomainEvent<Item>('shoppingItemCreated', commands.createShoppingItem, (item) => {
      // business logic

    })

  };

  var projections = {
    specialOfferProjection: new MongoProjection<SpecialOfferShoppingItem>('SpecialOffers', db, (proj, collection) => {

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

  return {
    domainEvents : domainEvents,
    projections : projections,
    commands : commands
  }

};


// running

var app = express();
app.use(bodyParser.json());


// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs')
  .then((db:mongodb.Db) => {

    var context = initServer(db);

    app.listen(9000, () => {
      console.info('Server is running!')
    });

    app.put('/createShoppingItem', (req: express.Request, res: express.Response) => {
      var params = req.body;

      context.commands.createShoppingItem.execute({
        name: params.name,
        price: params.price,
        sale: params.sale
      });

      res.send(200, {status:'ok'});
    });


    app.get('/specialOffers', (req: express.Request, res: express.Response) => {
      context.projections.specialOfferProjection.query({})
        .then((proj : SpecialOfferShoppingItem[]) => {

          res.json(proj);

        }).done();
    });

  }).done();
