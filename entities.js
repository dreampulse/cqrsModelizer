/// <reference path="./typings/mongodb/mongodb.d.ts"/>
/// <reference path="./typings/joi/joi.d.ts"/>
var Joi = require('joi');

////////////////////////////
////////// Domain Entities
exports.ActivitySchema = Joi.object().keys({
    desc: Joi.string().required(),
    bookableItems: Joi.array().includes(Joi.object({
        name: Joi.string().required(),
        price: Joi.number().integer().required(),
        quantity: Joi.number().min(0).required()
    })).required()
});
//# sourceMappingURL=entities.js.map
