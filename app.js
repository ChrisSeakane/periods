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
        const timezone = 'Europe/Copenhagen'
        const lang = 'en-GB'
        const start = '2023/01/01'
        const end = '2023/01/28'
        let s = DateTime.fromFormat(start, 'yyyy/MM/dd');
        let e = DateTime.fromFormat(end, 'yyyy/MM/dd');
        const n = DateTime.now(timezone);

        const choices = ['Day','Week','Month','Quarter','Year']

        let items = []

        choices.forEach((type) => {
          //const type = 'Day';
          const types = type.toLowerCase() + 's'
          let d = s.startOf(type).setLocale(lang)
          const startOfThis = n.startOf(type);
          //console.log(d)
          let i = Interval.fromDateTimes(d,d.endOf(type))

          let prevID = ''

          while(i.isBefore(e.plus({[types]:1}))){
            let item ={}
            item.Type = type
            item.Dates = i.toFormat('yyyy/MM/dd')
            let relativeStr = d.toRelative({base:startOfThis,unit:types})
            var r = /\d+/;
            const delta = parseInt(relativeStr.match(r),10)
            if (d< startOfThis){
              item.Relative = 0-delta
            }
            else {
              item.Relative = delta
            }
            let semanticStr = d.toRelativeCalendar({base:startOfThis,unit:types})
            item.Semantic = semanticStr;

            switch (type){
              case 'Day':
                item.Number = d.ordinal
                item.Name = d.toFormat('yyyy/MM/dd')
              break
              case 'Week':
                item.Number = d.weekNumber
                item.Name = d.weekYear + "W" + d.weekNumber.toString().padStart(2,'0')
              break
              case 'Month':
                item.Number = d.month
                item.Name = d.year + "M" + d.month.toString().padStart(2,'0') +  " " + d.monthShort + ""
              break
              case 'Quarter':
                item.Number = d.quarter
                item.Name = d.year + "Q" + d.quarter
              break
              case 'Year':
                item.Number = d.year
                item.Name = d.year.toString();
              break
              default:
            }

            if (Math.abs(delta)<=1){
              item.Name = item.Name  + " (" + item.Semantic + ")"
            }

            function isInType(arrayOfTypes,arrayToFill,interval) {
              let matchType = arrayOfTypes.pop()
              if (type !== matchType) {
                let matchS = Interval.fromDateTimes(interval.start.startOf(matchType),interval.start.endOf(matchType)).toFormat('yyyy/MM/dd');
                if(arrayToFill.indexOf(matchS) === -1) {
                  arrayToFill.push(uuid(JSON.stringify(matchS)));
                }
                let matchE = Interval.fromDateTimes(interval.end.startOf(matchType),interval.end.endOf(matchType)).toFormat('yyyy/MM/dd');

                if(arrayToFill.indexOf(matchE) === -1) {
                  arrayToFill.push(uuid(JSON.stringify(matchE)));
                } 

                if(arrayOfTypes.length >0) {
                isInType(arrayOfTypes,arrayToFill,interval)
              }
              }
              return arrayToFill
            }

            const matchTypes = ['Week','Month','Quarter','Year']

            let matchingTypes = [...choices];
            matchingTypes.shift();

            let isIn = []

            item.IsIn = isInType(matchingTypes,isIn,i);

            item.ID = uuid(JSON.stringify(item.Dates));
            item.Previous = prevID;
            prevID = item.ID

            items.push(item)

            d = d.plus({[types]:1})
            i = Interval.fromDateTimes(d,d.endOf(type))
          }
        });
        
        let dummyName = "Hello";
        
        items = [{id:uuid(JSON.stringify(dummyName)),name:dummyName}]
        
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
