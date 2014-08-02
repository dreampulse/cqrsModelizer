/// <reference path="./typings/tsd.d.ts"/>

import express = require('express');
import bodyParser = require('body-parser');
import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


import cqrs = require('./src/cqrs2');
var Command = cqrs.Command;
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;


////////////////////////////
////////// Domain Entities

interface ObjectId {
  _id : string;
}

module Activities {

  export interface User extends ObjectId {
    name : string;
  }

  export interface BookableItem {
    name : string;
    price : number;
    quantity : number;
  }

  export interface Activity {
    owner : User;
    desc : string;
    items : BookableItem[];
  }

  export interface UpdateActivity {
    _id : string;
    activity : Activity;
  }

}



///////////////////////////
// Projections

module Projections {
  export interface AllActivities extends Activities.Activity {
    _id : string;
  }

}


/////////////////////
// server


var initServer = function (db:mongodb.Db) {

  var appContext = new Context('appContext', db);

  var commands = {
    createActivity: appContext.createCommand<Activities.Activity>('createActivity'),
    updateActivity: appContext.createCommand<Activities.UpdateActivity>('updateActivity'),
    deleteActivity: appContext.createCommand<ObjectId>('deleteActivity')
  };

  var domainEvents = {
    activityCreated: new EventHandler<Activities.Activity>('activityCreated', commands.createActivity, (activity) => {
      // business logic
    }),
    activityUpdated: new EventHandler<Activities.UpdateActivity>('activityUpdated', commands.updateActivity, (activity) => {
      // business logic
    }),
    activityDeleted: new EventHandler<ObjectId>('activityDeleted', commands.deleteActivity, (id) => {
      // business logic
    })

  };

  // das hier ist quasi ein Aggregartor
  var projections = {
    allActivitiesProjection: new MongoProjection<Projections.AllActivities>('allActivities', db, (collection) => {

      // handle thise events for projection:
      domainEvents.activityCreated.handle((activity:Activities.Activity) => {
        collection('insert', activity);
      });

      domainEvents.activityUpdated.handle((activity:Activities.UpdateActivity) => {
        collection('update', {_id : activity._id}, activity.activity);
      });

      domainEvents.activityDeleted.handle((id:ObjectId) => {
        collection('remove', {_id : id._id});
      });

    })
  };

  return {
    domainEvents: domainEvents,
    projections: projections,
    commands: commands
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

    app.put('/activity', (req:express.Request, res:express.Response) => {
      var params = req.body;

      context.commands.createActivity.emit({
        owner : {
          _id : "123",
          name : 'Jonathan inc.'
        },
        desc : 'Epic Fun',
        items : [{
          name : 'Nabada',
          price : 0,
          quantity : 10000
        }]
      });

      res.send({status: 'ok'});
    });


    app.get('/activites', (req:express.Request, res:express.Response) => {
      context.projections.allActivitiesProjection.query({})
        .then((activites:Activities.Activity[]) => {

          res.json(activites);

        }).done();
    });

  }).done();
