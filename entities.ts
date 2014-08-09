/// <reference path="./typings/mongodb/mongodb.d.ts"/>
/// <reference path="./typings/joi/joi.d.ts"/>
import Joi = require('joi');

import mongodb = require('mongodb');

////////////////////////////
////////// Domain Entities

export var ActivitySchema = Joi.object().keys({
  desc : Joi.string().required(),
  bookableItems : Joi.array().includes(Joi.object({
    name : Joi.string().required(),
    price : Joi.number().integer().required(),
    quantity : Joi.number().min(0).required()
  })).required()
});

export interface Activity {
  desc : string;
  bookableItems : {
    name : string;
    price : number;
    quantity : number;
  }[];
}

export module Activity {

  export interface ForAllDoc extends Activity {
    _id : mongodb.ObjectID;
    owner_name : string;
    owner : mongodb.ObjectID;
  }

  export interface ForProvidersDoc extends Activity {
    _id : mongodb.ObjectID;
    owner : mongodb.ObjectID;
  }

  export interface Doc extends Activity {
    _id : mongodb.ObjectID;
  }

}

export interface User {
  name : string;
  email : string;
  password : string;
}

export module User {

  export interface Login {
    email : string;
    password : string;
  }

  export interface Doc extends User {
    _id : mongodb.ObjectID;
  }

}

