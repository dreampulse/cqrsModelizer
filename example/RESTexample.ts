/// <reference path="../typings/tsd.d.ts"/>


import assert = require('assert');
import express = require('express');
import bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

import Joi = require('joi');

import mongodb = require('mongodb');
import Q = require('q');
Q.longStackSupport = true;


import cqrs = require('../src/cqrs');
import helpers = require('../src/helpers');
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;
var DomainEvent = cqrs.DomainEvent;

import Entities = require('./entities');

module States {
  export interface User extends Entities.User.Doc {}
}

interface ExpressRequest extends express.Request {
  session : {
    user : States.User;
    isAuth : () => boolean;
  };
}

interface Empty {}




/////////////////////
// server

var initServer = function (db:mongodb.Db) {

  var domainEvents = {
    activityCreated: new DomainEvent<Entities.Activity, States.User>('activityCreated', 'appContext', db),
    activityUpdated: new DomainEvent<Entities.Activity.Doc, States.User>('activityUpdated', 'appContext', db),
    activityDeleted: new DomainEvent<cqrs.ObjId, States.User>('activityDeleted', 'appContext', db)
  };

  var projections = {

      allActivitiesProjection:
        new helpers.MongoCURDProjection<Entities.Activity.ForAllDoc, States.User>('allActivities', db,
          domainEvents.activityCreated,
          domainEvents.activityUpdated,
          domainEvents.activityDeleted
        ),

      providerActivitiesProjection: new MongoProjection<Entities.Activity.ForProvidersDoc>('allActivities', db, (collection) => {

        domainEvents.activityCreated.handle((activity:Entities.Activity, user:States.User) => {
          var doc = <Entities.Activity.ForProvidersDoc>activity;
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

    var theUser : Entities.User.Doc = {
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


    // projection
    app.get('/activities', (req:ExpressRequest, res:express.Response) => {
      context.projections.allActivitiesProjection.query({})
        .then((activities : Entities.Activity.ForAllDoc[]) => {
          res.json(activities);
        }).done();
    });


    ///////////// private API-Part

    // check authentication
    app.use((req:ExpressRequest, res:express.Response, next: Function) => {
      if (req.session.isAuth()) next();
      else res.status(401).send({'ok': false, 'err': 'not logged in'});
    });

    app.put('/activity', (req:ExpressRequest, res:express.Response) => {
      var params = <Entities.Activity>req.body;
      Joi.assert(params, Entities.ActivitySchema);

      context.domainEvents.activityCreated.emit(params, req.session.user);
      res.json({ok:true});
    });

    // update
    app.post('/activity', (req:ExpressRequest, res:express.Response) => {
      var params = <Entities.Activity.Doc>req.body;

      Joi.assert(params, Entities.ActivitySchema.keys({ _id: Joi.string().required() }).required());
      params._id = new mongodb.ObjectID(req.body._id);

      context.domainEvents.activityUpdated.emit(params, req.session.user);
      res.json({ok:true});
    });

    // delete
    app.delete('/activity', (req:ExpressRequest, res:express.Response) => {
      var params = <cqrs.ObjId>req.body;

      Joi.assert(params, Joi.object().keys({_id: Joi.string().required()}).required());
      params._id = new mongodb.ObjectID(req.body._id);

      context.domainEvents.activityDeleted.emit(params, req.session.user);
      res.json({ok:true});
    });


  }).done();

// loadtest -n 1000 -c 4 -T "Content-Type: application/json" -P "{}" http://localhost:3000/activity
// ab -c 1 -n 1 -T "Content-Type: application/json" -u test.data.json http://127.0.0.1:3000/activity
// curl -X PUT -H "Content-Type: application/json" --data @test.data.json http://localhost:3000/activity