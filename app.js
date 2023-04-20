const express = require(`express`);
const path = require(`path`);
const logger = require(`morgan`);
const wrap = require(`express-async-wrap`);
const _ = require(`lodash`);
const uuid = require(`uuid-by-string`);
const got = require(`got`);
const spacetime = require(`spacetime`);
const { DateTime, Interval } = require("luxon");

const getYearRange = filter => {
    let fromYear = parseInt(filter.from);
    let toYear = parseInt(filter.to);

    if (_.isNaN(fromYear)) {
        fromYear = new Date().getFullYear();
    }
    if (_.isNaN(toYear)) {
        toYear = new Date().getFullYear();
    }
    const yearRange = [];
    while(fromYear <= toYear) {
        yearRange.push(fromYear);
        fromYear++;
    }
    return yearRange;
};

const app = express();
app.use(logger(`dev`));
app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.get(`/logo`, (req, res) => res.sendFile(path.resolve(__dirname, `logo.svg`)));

const appConfig = require(`./config.app.json`);
app.get(`/`, (req, res) => res.json(appConfig));

app.post(`/validate`, (req, res) => res.json({name: `Public`}));

const syncConfig = require(`./config.sync.json`);
app.post(`/api/v1/synchronizer/config`, (req, res) => res.json(syncConfig));

const schema = require(`./schema.json`);
app.post(`/api/v1/synchronizer/schema`, (req, res) => res.json(schema));

function getTitle(name) {
  let s = spacetime('2000',name);
  return {title:s.timezone().name, value:name};
}

app.post(`/api/v1/synchronizer/datalist`, wrap(async (req, res) => {

    let tzs = spacetime().timezones;
    
    let temp = Object.keys(tzs);
    console.log(temp)
    temp = temp.map(getTitle)
    console.log(temp);
    const items = temp.sort((a, b) => (a.title > b.title) ? 1: -1);
    
    res.json({items});
}));

app.post(`/api/v1/synchronizer/data`, wrap(async (req, res) => {
    const {requestedType, filter} = req.body;
    if (requestedType !== `period`) {
        throw new Error(`Only this database can be synchronized`);
    }
    /*
    if (_.isEmpty(filter.countries)) {
        throw new Error(`Countries filter should be specified`);
    }
    */
    const {timezone} = filter;
    const yearRange = getYearRange(filter);
    //var linkID;
    

    if (requestedType == `period`){
        const items = [];
        const item = {
            name: "Week 1"
        };
        item.id = uuid(JSON.stringify(item));
        items.push(item);
        return res.json({items});
    }
}));

app.use(function (req, res, next) {
    const error = new Error(`Not found`);
    error.status = 404;
    next(error);
});

app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    console.log(err);
    res.json({message: err.message, code: err.status || 500});
});

module.exports = app;
