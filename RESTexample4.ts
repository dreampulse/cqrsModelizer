/// <reference path="./typings/tsd.d.ts"/>

import assert = require('assert');
import express = require('express');
import bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;



import cqrs = require('./src/cqrs4');
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;
var DomainEvent = cqrs.DomainEvent;

module States {
  export interface User extends User.Doc {}
}

interface ExpressRequest extends express.Request {
  session : {
    user : States.User;
    isAuth : () => boolean;
  };
}

interface Empty {}

////////////////////////////
////////// Domain Entities


module Activity {

//  export interface BookableItem {
//    name : string;
//    price : number;
//    quantity : number;
//  }

  export interface Activity {
    desc : string;
    bookableItems : {
      name : string;
      price : number;
      quantity : number;
    }[];
  }

  export interface ForAllDoc extends Activity {
    _id : mongodb.ObjectID;
    owner_name : string;
  }

  export interface ForProvidersDoc extends Activity {
    _id : mongodb.ObjectID;
    owner : mongodb.ObjectID;
  }


}

module User {
  export interface User {
    name : string;
    email : string;
    password : string;
  }

  export interface Login {
    email : string;
    password : string;
  }

  export interface Doc extends User {
    _id : mongodb.ObjectID;
  }

}


///////////////////////////
// Projections



 module Activity {

    export interface User {
      _id : mongodb.ObjectID;
      name : string;
    }

    export interface Activities extends Activity.Activity {
      _id : mongodb.ObjectID;
      owner : User;
    }
}


/////////////////////
// server


var initServer = function (db:mongodb.Db) {

  var domainEvents = {
      activityAdded: new DomainEvent<Activity.Activity, States.User>('activityAdded', 'appContext', db)
  };


  var projections = {

      allActivitiesProjection: new MongoProjection<Activity.ForAllDoc>('allActivities', db, (collection) =>{

        domainEvents.activityAdded.handle((activity:Activity.Activity, user:States.User) => {
          var doc = <Activity.ForAllDoc>activity;
          doc.owner_name = user.name;
          collection.insert(doc);
        });

      }),

      providerActivitiesProjection: new MongoProjection<Activity.ForProvidersDoc>('allActivities', db, (collection) =>{

        domainEvents.activityAdded.handle((activity:Activity.Activity, user:States.User) => {
          var doc = <Activity.ForProvidersDoc>activity;
          doc.owner = user._id;
          collection.insert(doc);
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
app.use(session({secret: 'bak-gAt-arC-eF', resave: true, saveUninitialized: true}));


// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs')
  .then((db:mongodb.Db) => {

    var context = initServer(db);

    app.listen(3000, () => {
      console.info('Server is running!')
    });

    var theUser : User.Doc = {
      name : "Jonathan",
      email : "sqrs-test@dreampulse.de",
      password : "secret",
      _id : new mongodb.ObjectID()
    };

    // assume a session
    // usually you would do this via passport or so
    app.use((req:ExpressRequest, res:express.Response, next: Function) => {
      req.session.user = theUser;
      req.session.isAuth = () => { return true; };
      next();
    });


    // loadtest -n 1000 -c 4 -T "Content-Type: application/json" -P "{}" http://localhost:3000/activity
    // ab -c 4 -n 10000 -T "Content-Type: application/json" -p test.data.json http://127.0.0.1:3000/activity
    app.post('/activity', (req:ExpressRequest, res:express.Response) => {
      var params = <Activity.Activity>req.body;

      params = {
        desc : 'Nabada',
        bookableItems : [
          {
            name : "Wildes Nabada",
            price : 0,
            quantity : 20000
          }, {
            name : "After Party",
            price : 8,
            quantity : 5000
          }
        ]
      };

      if (req.session.isAuth()) {
        context.domainEvents.activityAdded.emit(params, req.session.user);
        res.json({ok:true});
      }
    });


    app.get('/activities', (req:ExpressRequest, res:express.Response) => {
        context.projections.allActivitiesProjection.query({})
          .then((activities : Activity.ForAllDoc[]) => {
            res.json(activities);
          }).done();
    });

  }).done();