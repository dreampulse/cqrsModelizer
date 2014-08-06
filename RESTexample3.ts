/// <reference path="./typings/tsd.d.ts"/>

import assert = require('assert');
import express = require('express');
import bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

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
var DomainEvent = cqrs.DomainEvent;


interface ExpressRequest extends express.Request {
  session : {
    user : User.Doc
  };
}

interface Empty {}

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


}


/////////////////////
// server


var initServer = function (db:mongodb.Db) {

  var domainEvents = {
    userRegistered: new DomainEvent<User.User>('userRegistered', 'appContext', db),
    userLoggedIn: new DomainEvent<Empty>('userLoggedIn', 'appContext', db),
    userEdited: new DomainEvent<User.Doc>('userEdited', 'appContext', db),
    userRemoved: new DomainEvent<mongodb.ObjectID>('userRemoved', 'appContext', db)
  };

  var projections = {
    usersProjection: new MongoProjection<User.Doc>('users', db, (collection) => {

      // handle thise events for projection:
      domainEvents.userRegistered.handle((user:User.User) => {

        var doc:User.Doc = {
          _id: new mongodb.ObjectID(), // will be created by the server
          email: user.email,
          name: user.name,
          password: user.password
        };
        collection.insert(doc);
      });

      domainEvents.userEdited.handle((updatedUser:User.Doc) => {
        collection.update({_id: updatedUser._id}, updatedUser);
      });

      domainEvents.userRemoved.handle((id:mongodb.ObjectID) => {
        collection.remove(id);
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

    // Command: Register User
    app.put('/user', (req:ExpressRequest, res:express.Response) => {
      var params = <User.User>req.body;

      context.projections.usersProjection.query({email: params.email})
        .then((users:User.Doc[]) => {
          assert(users.length < 1, "User already registered");

          context.domainEvents.userRegistered.emit(params);
          res.json({'ok': true});
        }).fail((err:Error) => {
          res.json(500, {'ok': false, 'err': err});
        });
    });

    // Command: Login
    app.post('/user/login', (req:ExpressRequest, res:express.Response) => {
      var params = <User.Login>req.body;

      context.projections.usersProjection.query({email: params.email})
        .then((users:User.Doc[]) => {
          if (users.length > 1) {
            throw new Error("That shout not happen");
          }
          if (users.length < 1) {
            throw new Error("User not found");
          }
          if (users.length == 1) {
            if (users[0].password !== params.password) {  // wrong password
              throw new Error("Wrong password");
            } else {
              req.session.user = users[0];
              context.domainEvents.userLoggedIn.emit({});
              res.json({'ok': true});
            }
          }
        }).fail((err:Error) => {
          res.json(500, {'ok': false, 'err': err});
        });
    });

    // Command: Edit User
    app.post('/user', (req:ExpressRequest, res:express.Response) => {
      var params = <User.User>req.body;
      if (req.session.user) { // logged in

        context.projections.usersProjection.query({_id: req.session.user._id})
          .then((users:User.Doc[]) => {
            assert(users.length == 1, "User not found");

            var doc = <User.Doc>params;
            doc._id = req.session.user._id;

            context.domainEvents.userEdited.emit(doc);
          }).fail((err:Error) => {
            res.json(500, {'ok': false, 'err': err});
          });

      } else {
        res.json(401, {'ok': false, 'err': 'not logged in'});
      }
    });


    // Command: Delete User
    app.delete('/user', (req:ExpressRequest, res:express.Response) => {
      if (req.session.user) { // logged in
        context.domainEvents.userRemoved.emit(req.session.user._id);
        delete req.session.user;
      }
    });

    app.put('/activity', (req:express.Request, res:express.Response) => {

    });


    app.get('/activites', (req:express.Request, res:express.Response) => {

    });

  }).done();