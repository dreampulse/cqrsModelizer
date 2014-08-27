/// <reference path="./../typings/tsd.d.ts"/>

import express = require('express');
import bodyParser = require('body-parser');
import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


import cqrs = require('./src/cqrs3');
var Command = cqrs.Command;
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;


interface ObjectId {
  _id : mongodb.ObjectID;
}

interface Update<T> {
  _id : mongodb.ObjectID;
  object : T;
}

////////////////////////////
////////// Domain Entities


module Activities {

  export interface BookableItem {
    name : string;
    price : number;
    quantity : number;
  }

  export interface Activity {
    desc : string;
    items : BookableItem[];
  }

}

module Users {
  export interface User {
    name : string;
    email : string;
    password : string;
  }
}



///////////////////////////
// Projections


module Projections {

  export module Activity {
    export interface User {
      _id : mongodb.ObjectID;
      name : string;
    }

    export interface Activities extends Activities.Activity {
      _id : mongodb.ObjectID;
      owner : User;
    }
  }

  export interface Users extends Users.User {
    _id : mongodb.ObjectID;
  }

}


/////////////////////
// server


var initServer = function (db:mongodb.Db) {

  var appContext = new Context('appContext', db);

  var commands = {
    createActivity: new StoredEventProvider<Activities.Activity>('createActivity', 'appContext', db),
    updateActivity: appContext.createCommand< Update<Activities.Activity> >('updateActivity'),
    deleteActivity: appContext.createCommand<ObjectId>('deleteActivity'),

    createUser: appContext.createCommand<Users.User>('createUser'),
    updateUser: appContext.createCommand< Update<Users.User> >('updateUser'),
    deleteUser: appContext.createCommand<ObjectId>('deleteUser')
  };

  var domainEvents = {
    activityCreated: new EventHandler<Activities.Activity>('activityCreated', commands.createActivity, (activity) => {
      // business logic
    }),
    activityUpdated: new EventHandler< Update<Activities.Activity> >('activityUpdated', commands.updateActivity, (update) => {
      // business logic
    }),
    activityDeleted: new EventHandler<ObjectId>('activityDeleted', commands.deleteActivity, (id) => {
      // business logic
    }),

    userCreated: new EventHandler<Users.User>('userCreated', commands.createUser, (user) => {
      // business logic
    }),
    userUpdated: new EventHandler< Update<Users.User> >('userUpdated', commands.updateUser, (update) => {
      // business logic
    }),
    userDeleted: new EventHandler<ObjectId>('userDeleted', commands.deleteUser, (id) => {
      // business logic
    })

  };

  // das hier ist quasi ein Aggregartor
  var projections = {
    activitiesProjection: new MongoProjection<Projections.Activity.Activities>('activities', db, (collection) => {

      // handle thise events for projection:
      domainEvents.activityCreated.handle((activity:Activities.Activity) => {

        var activityProjection = <Projections.Activity.Activities>activity;
        activityProjection._id = new mongodb.ObjectID();
        activityProjection.owner = {
          _id : new mongodb.ObjectID(),
          name :'jonathan'
        };
        collection.insert(activityProjection);
      });

      domainEvents.activityUpdated.handle((activity:Update<Activities.Activity>) => {
        collection.execute('update', {_id : activity._id}, activity.object);
      });

      domainEvents.activityDeleted.handle((id:ObjectId) => {
        collection.execute('remove', {_id : id._id});
      });


      // user Handling
      domainEvents.userUpdated.handle((update:Update<Users.User>) => {
        // update name
        collection.execute('update', { 'owner._id' : update._id}, {
          '$set' : { 'owner.name' : update.object.name}
        });
      });

      domainEvents.userDeleted.handle((update:Update<Users.User>) => {
        // also delete activity
        collection.execute('remove', { 'owner._id' : update._id});
      });

    }),

    usersProjection: new MongoProjection<Projections.Users>('users', db, (collection) => {

      // handle thise events for projection:
      domainEvents.userCreated.handle((user:Users.User) => {
        var userProjection = <Projections.Users>user;
        userProjection._id = new mongodb.ObjectID();
        collection.insert(userProjection);
      });

      domainEvents.userUpdated.handle((update:Update<Users.User>) => {
        collection.execute('update', {_id : update._id}, update.object);
      });

      domainEvents.userDeleted.handle((id:ObjectId) => {
        collection.execute('remove', {_id : id._id});
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
      context.projections.activitiesProjection.query({})
        .then((activites:Activities.Activity[]) => {

          res.json(activites);

        }).done();
    });

  }).done();
