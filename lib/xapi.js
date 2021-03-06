'use strict';

var Xsql = require('./xsql.js');
var multer = require('multer');
var path = require('path');


//define class
class Xapi {

  constructor(args, mysqlPool, app) {

    this.config = args;
    this.mysql = new Xsql(args, mysqlPool)
    this.app = app;

    /**************** START : multer ****************/
    this.storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, process.cwd())
      },
      filename: function (req, file, cb) {
        console.log(file);
        cb(null, Date.now() + '-' + file.originalname)
      }
    })

    this.upload = multer({storage: this.storage})
    /**************** END : multer ****************/


  }


  init(cbk) {

    this.mysql.init((err, results) => {

      this.app.use(this.urlMiddleware.bind(this))
      let stat = this.setupRoutes()
      this.app.use(this.errorMiddleware.bind(this))
      cbk(err, stat)

    })

  }


  urlMiddleware(req, res, next) {

    // get only request url from originalUrl
    let justUrl = req.originalUrl.split('?')[0]
    let pathSplit = []

    // split by apiPrefix
    let apiSuffix = justUrl.split(this.config.apiPrefix)

    if (apiSuffix.length === 2) {
      // split by /
      pathSplit = apiSuffix[1].split('/')
      if (pathSplit.length) {
        if (pathSplit.length >= 3) {
          // handle for relational routes
          req.app.locals._parentTable = pathSplit[0]
          req.app.locals._childTable = pathSplit[2]
        } else {
          // handles rest of routes
          req.app.locals._tableName = pathSplit[0]
        }

      }
    }

    next();

  }


  errorMiddleware(err, req, res, next) {

    if (err && err.code)
      res.status(400).json({error: err});
    else if (err && err.message)
      res.status(500).json({error: 'Internal server error : ' + err.message});
    else
      res.status(500).json({error: 'Internal server error : ' + err});

    next(err);

  }

  asyncMiddleware(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next))
        .catch((err) => {
          next(err);
        });
    }
  }

  root(req, res) {

    let routes = [];
    routes = this.mysql.getSchemaRoutes(false, req.protocol + '://' + req.get('host') + this.config.apiPrefix);
    routes = routes.concat(this.mysql.globalRoutesPrint(req.protocol + '://' + req.get('host') + this.config.apiPrefix))
    res.json(routes)

  }

  setupRoutes() {

    let stat = {}
    stat.tables = 0
    stat.apis = 0

    // show routes for database schema
    this.app.get('/', this.asyncMiddleware(this.root.bind(this)))

    // show all resouces
    this.app.route(this.config.apiPrefix + 'tables')
      .get(this.asyncMiddleware(this.tables.bind(this)));

    this.app.route(this.config.apiPrefix + 'xjoin')
      .get(this.asyncMiddleware(this.xjoin.bind(this)));

    stat.api += 3;


    /**************** START : setup routes for each table ****************/
    let resources = [];
    resources = this.mysql.getSchemaRoutes(true, this.config.apiPrefix);

    stat.tables += resources.length

    // iterate over each resource
    for (var j = 0; j < resources.length; ++j) {

      let routes = resources[j]['routes'];

      stat.apis += resources[j]['routes'].length

      // iterate over rach routes in resource and map function
      for (var i = 0; i < routes.length; ++i) {

        switch (routes[i]['routeType']) {

          case 'list':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.list.bind(this)));
            break;

          case 'findOne':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.findOne.bind(this)));
            break;

          case 'create':
            this.app.route(routes[i]['routeUrl'])
              .post(this.asyncMiddleware(this.create.bind(this)));
            break;

          case 'read':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.read.bind(this)));
            break;

          case 'bulkInsert':
            this.app.route(routes[i]['routeUrl'])
              .post(this.asyncMiddleware(this.bulkInsert.bind(this)));
            break;

          case 'bulkRead':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.bulkRead.bind(this)));
            break;

          case 'bulkDelete':
            this.app.route(routes[i]['routeUrl'])
              .delete(this.asyncMiddleware(this.bulkDelete.bind(this)));
            break;

          case 'patch':
            this.app.route(routes[i]['routeUrl'])
              .patch(this.asyncMiddleware(this.patch.bind(this)));
            break;

          case 'update':
            this.app.route(routes[i]['routeUrl'])
              .put(this.asyncMiddleware(this.update.bind(this)));
            break;

          case 'delete':
            this.app.route(routes[i]['routeUrl'])
              .delete(this.asyncMiddleware(this.delete.bind(this)));
            break;

          case 'exists':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.exists.bind(this)));
            break;

          case 'count':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.count.bind(this)));
            break;

          case 'distinct':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.distinct.bind(this)));
            break;

          case 'describe':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.tableDescribe.bind(this)));
            break;

          case 'relational':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.nestedList.bind(this)));
            break;

          case 'groupby':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.groupBy.bind(this)));
            break;

          case 'ugroupby':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.ugroupby.bind(this)));
            break;

          case 'chart':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.chart.bind(this)));
            break;

          case 'autoChart':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.autoChart.bind(this)));
            break;

          case 'aggregate':
            this.app.route(routes[i]['routeUrl'])
              .get(this.asyncMiddleware(this.aggregate.bind(this)));
            break;

        }
      }
    }
    /**************** END : setup routes for each table ****************/


    if (this.config.dynamic === 1) {

      this.app.route('/dynamic*')
        .post(this.asyncMiddleware(this.runQuery.bind(this)));

      /**************** START : multer routes ****************/
      this.app.post('/upload', this.upload.single('file'), this.uploadFile.bind(this));
      this.app.post('/uploads', this.upload.array('files', 10), this.uploadFiles.bind(this));
      this.app.get('/download', this.downloadFile.bind(this));
      /**************** END : multer routes ****************/

      stat.api += 4;

    }

    let statStr = '     Generated: ' + stat.apis + ' REST APIs for ' + stat.tables + ' tables '

    console.log(' - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ');
    console.log('                                                            ');
    console.log('          Database              :    %s', this.config.database);
    console.log('          Number of Tables      :    %s', stat.tables);
    console.log('                                                            ');
    console.log('          REST APIs Generated   :    %s'.green.bold, stat.apis);
    console.log('                                                            ');
    return stat
  }

  async create(req, res) {

    let query = 'INSERT INTO ?? SET ?';
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }


  async list(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = ''
    queryParamsObj.params = []

    this.mysql.prepareListQuery(req, res, queryParamsObj, 0);

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }


  async xjoin(req, res) {

    let obj = {}

    obj.query = '';
    obj.params = [];

    this.mysql.prepareJoinQuery(req, res, obj)

    //console.log(obj);

    let results = await this.mysql.exec(obj.query, obj.params)
    res.status(200).json(results)

    //http://localhost:3000/api/xjoin?_join=pl.productlines,j,pr.products,j,ord.orderdetails&on1=(pl.productline,eq,pr.products)&on2=(pr.productcode,eq,ord.productcode)

  }


  async nestedList(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = '';
    queryParamsObj.params = [];

    this.mysql.prepareListQuery(req, res, queryParamsObj, 1)

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }

  async findOne(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = ''
    queryParamsObj.params = []

    this.mysql.prepareListQuery(req, res, queryParamsObj, 2);

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }

  async read(req, res) {

    let query = 'select * from ?? where ';
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
      req.params.id.split('___'));


    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;
    query += ' LIMIT 1'

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async exists(req, res) {

    let query = 'select * from ?? where ';
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += clause;
    query += ' LIMIT 1'

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }


  async update(req, res) {

    let query = 'REPLACE INTO ?? SET ?';
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(req.body);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async patch(req, res) {

    let query = 'UPDATE ?? SET ';
    let keys = Object.keys(req.body);

    // SET clause
    let updateKeys = '';
    for (let i = 0; i < keys.length; ++i) {
      updateKeys += keys[i] + ' = ? '
      if (i !== keys.length - 1)
        updateKeys += ', '
    }

    // where clause
    query += updateKeys + ' where '
    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      })
    }

    query += clause;

    // params
    let params = [];
    params.push(req.app.locals._tableName);
    params = params.concat(Object.values(req.body));

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async delete(req, res) {

    let query = 'DELETE FROM ?? WHERE ';
    let params = [];

    params.push(req.app.locals._tableName);

    let clause = this.mysql.getPrimaryKeyWhereClause(req.app.locals._tableName,
      req.params.id.split('___'));

    if (!clause) {
      return res.status(400).send({
        error: "Table is made of composite primary keys - all keys were not in input"
      });
    }

    query += clause;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async bulkInsert(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = ''
    queryParamsObj.params = []
    let results = []

    //console.log(req.app.locals._tableName, req.body);

    this.mysql.getBulkInsertStatement(req.app.locals._tableName, req.body, queryParamsObj)

    results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }

  async bulkDelete(req, res) {

    let query = 'delete from ?? where ?? in ';
    let params = [];

    params.push(req.app.locals._tableName);
    params.push(this.mysql.getPrimaryKeyName(req.app.locals._tableName));

    query += '('

    if (req.query && req.query._ids) {
      let ids = req.query._ids.split(',')
      for (var i = 0; i < ids.length; ++i) {
        if (i) {
          query += ','
        }
        query += '?'
        params.push(ids[i])
      }
    }

    query += ')'

    //console.log(query, params);

    var results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async bulkRead(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = ''
    queryParamsObj.params = []

    this.mysql.prepareListQuery(req, res, queryParamsObj, 3);

    //console.log(queryParamsObj.query, queryParamsObj.params);

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }


  async count(req, res) {

    let queryParams = {}

    queryParams.query = 'select count(1) as no_of_rows from ?? ';
    queryParams.params = [];

    queryParams.params.push(req.app.locals._tableName);

    this.mysql.getWhereClause(req.query._where, req.app.locals._tableName, queryParams, ' where ')

    let results = await this.mysql.exec(queryParams.query, queryParams.params);
    res.status(200).json(results);

  }

  async distinct(req, res) {

    let queryParamsObj = {}
    queryParamsObj.query = ''
    queryParamsObj.params = []

    this.mysql.prepareListQuery(req, res, queryParamsObj, 4);

    let results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);
    res.status(200).json(results);

  }

  async tables(req, res) {

    let query = 'SELECT table_name AS resource FROM information_schema.tables WHERE table_schema = ? ';
    let params = [this.config.database];

    if (Object.keys(this.config.ignoreTables).length > 0) {
      query += 'and table_name not in (?)'
      params.push(Object.keys(this.config.ignoreTables))
    }

    let results = await this.mysql.exec(query, params)

    res.status(200).json(results)
  }


  async runQuery(req, res) {

    let query = req.body.query;
    let params = req.body.params;

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);


  }

  async tableDescribe(req, res) {

    let query = 'describe ??';
    let params = [req.app.locals._tableName];

    let results = await this.mysql.exec(query, params);
    res.status(200).json(results);

  }

  async groupBy(req, res) {

    if (req.query && req.query._fields) {

      let queryParamsObj = {}
      queryParamsObj.query = 'select ';
      queryParamsObj.params = [];

      /**************** add columns and group by columns ****************/
      this.mysql.getColumnsForSelectStmt(req.app.locals._tableName, req.query, queryParamsObj)

      queryParamsObj.query += ',count(*) as _count from ?? group by ';
      let tableName = req.app.locals._tableName;
      queryParamsObj.params.push(tableName);

      this.mysql.getColumnsForSelectStmt(req.app.locals._tableName, req.query, queryParamsObj)

      if (!req.query._sort) {
        req.query._sort = {}
        req.query._sort = '-_count'
      }

      /**************** add having clause ****************/
      this.mysql.getHavingClause(req.query._having, req.app.locals._tableName, queryParamsObj, ' having ');

      /**************** add orderby clause ****************/
      this.mysql.getOrderByClause(req.query, tableName, queryParamsObj);

      //console.log(queryParamsObj.query, queryParamsObj.params);
      var results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);

      res.status(200).json(results);

    } else {
      res.status(400).json({message: 'Missing _fields query params eg: /api/tableName/groupby?_fields=column1'})
    }

  }

  async ugroupby(req, res) {

    if (req.query && req.query._fields) {

      let queryParamsObj = {}
      queryParamsObj.query = '';
      queryParamsObj.params = [];
      let uGrpByResults = {}

      /**************** add fields with count(*) *****************/
      let fields = req.query._fields.split(',')

      for (var i = 0; i < fields.length; ++i) {

        uGrpByResults[fields[i]] = []

        if (i) {
          queryParamsObj.query += ' UNION '
        }
        queryParamsObj.query += ' SELECT IFNULL(CONCAT(?,?,??),?) as ugroupby, count(*) as _count from ?? GROUP BY ?? '
        queryParamsObj.params.push(fields[i])
        queryParamsObj.params.push('~')
        queryParamsObj.params.push(fields[i])
        queryParamsObj.params.push(fields[i] + '~')
        queryParamsObj.params.push(req.app.locals._tableName)
        queryParamsObj.params.push(fields[i])
      }

      //console.log(queryParamsObj.query, queryParamsObj.params);
      var results = await this.mysql.exec(queryParamsObj.query, queryParamsObj.params);

      for (var i = 0; i < results.length; ++i) {

        let grpByColName = results[i]['ugroupby'].split('~')[0]
        let grpByColValue = results[i]['ugroupby'].split('~')[1]

        let obj = {}
        obj[grpByColValue] = results[i]['_count'];

        uGrpByResults[grpByColName].push(obj)

      }

      res.status(200).json(uGrpByResults);

    } else {
      res.status(400).json({message: 'Missing _fields query params eg: /api/tableName/ugroupby?_fields=column1,column2'})
    }
  }


  async aggregate(req, res) {


    if (req.query && req.query._fields) {
      let tableName = req.app.locals._tableName;
      let query = 'select '
      let params = []
      let fields = req.query._fields.split(',');

      for (var i = 0; i < fields.length; ++i) {
        if (i) {
          query = query + ','
        }
        query = query + ' min(??) as ?,max(??) as ?,avg(??) as ?,sum(??) as ?,stddev(??) as ?,variance(??) as ? '
        params.push(fields[i]);
        params.push('min_of_' + fields[i]);
        params.push(fields[i]);
        params.push('max_of_' + fields[i]);
        params.push(fields[i]);
        params.push('avg_of_' + fields[i]);
        params.push(fields[i]);
        params.push('sum_of_' + fields[i]);
        params.push(fields[i]);
        params.push('stddev_of_' + fields[i]);
        params.push(fields[i]);
        params.push('variance_of_' + fields[i]);
      }

      query = query + ' from ??'
      params.push(tableName)

      var results = await this.mysql.exec(query, params);

      res.status(200).json(results);
    } else {
      res.status(400).json({message: 'Missing _fields in query params eg: /api/tableName/aggregate?_fields=numericColumn1'});
    }

  }


  async chart(req, res) {

    let query = ''
    let params = []
    let obj = {}


    if (req.query) {

      let isRange = false
      if (req.query.range) {
        isRange = true
      }

      if (req.query && req.query.min && req.query.max && req.query.step) {

        //console.log(req.params.min, req.params.max, req.params.step);

        obj = this.mysql.getChartQueryAndParamsFromMinMaxStep(req.app.locals._tableName,
          req.query._fields,
          parseInt(req.query.min),
          parseInt(req.query.max),
          parseInt(req.query.step),
          isRange)


      } else if (req.query && req.query.steparray && req.query.steparray.length > 1) {

        obj = this.mysql.getChartQueryAndParamsFromStepArray(req.app.locals._tableName,
          req.query._fields,
          (req.query.steparray.split(',')).map(Number),
          isRange)


      } else if (req.query && req.query.steppair && req.query.steppair.length > 1) {

        obj = this.mysql.getChartQueryAndParamsFromStepPair(req.app.locals._tableName,
          req.query._fields,
          (req.query.steppair.split(',')).map(Number),
          false)


      } else {

        query = 'select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??';
        params = [];

        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.query._fields);
        params.push(req.app.locals._tableName);

        let _this = this;

        let results = await
          _this.mysql.exec(query, params);

        //console.log(results, results['max'], req.params);

        obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(req.app.locals._tableName,
          req.query._fields,
          results[0]['min'],
          results[0]['max'],
          results[0]['stddev'],
          isRange
        )

      }

      this.mysql.getWhereClause(req.query._where, req.app.locals._tableName, obj, ' where ')

      let results = await
        this.mysql.exec(obj.query, obj.params);

      res.status(200).json(results);

    } else {
      res.status(400).json({message: 'Missing _fields in query params eg: /api/tableName/chart?_fields=numericColumn1'});
    }


  }


  async autoChart(req, res) {

    let query = 'describe ??'
    let params = [req.app.locals._tableName]
    let obj = {}
    let results = []

    let isRange = false
    if (req.query.range) {
      isRange = true
    }


    let describeResults = await this.mysql.exec(query, params)

    //console.log(describeResults);

    for (var i = 0; i < describeResults.length; ++i) {

      //console.log('is this numeric column', describeResults[i]['Type']);

      if (describeResults[i]['Key'] !== 'PRI' && this.mysql.isTypeOfColumnNumber(describeResults[i]['Type'])) {

        query = 'select min(??) as min,max(??) as max,stddev(??) as stddev,avg(??) as avg from ??';
        params = [];

        params.push(describeResults[i]['Field']);
        params.push(describeResults[i]['Field']);
        params.push(describeResults[i]['Field']);
        params.push(describeResults[i]['Field']);
        params.push(req.app.locals._tableName);

        let _this = this;

        let minMaxResults = await _this.mysql.exec(query, params);

        //console.log(minMaxResults, minMaxResults['max'], req.params);

        query = ''
        params = []

        obj = _this.mysql.getChartQueryAndParamsFromMinMaxStddev(req.app.locals._tableName,
          describeResults[i]['Field'],
          minMaxResults[0]['min'],
          minMaxResults[0]['max'],
          minMaxResults[0]['stddev'],
          isRange
        )

        let r = await this.mysql.exec(obj.query, obj.params);

        let resultObj = {}
        resultObj['column'] = describeResults[i]['Field']
        resultObj['chart'] = r

        results.push(resultObj);

      }
    }

    res.status(200).json(results);
  }


  /**************** START : files related ****************/
  downloadFile(req, res) {
    let file = path.join(process.cwd(), req.query.name);
    res.download(file);
  }

  uploadFile(req, res) {

    if (req.file) {
      console.log(req.file.path);
      res.end(req.file.path);
    } else {
      res.end('upload failed');
    }
  }

  uploadFiles(req, res) {

    if (!req.files || req.files.length === 0) {
      res.end('upload failed')
    } else {
      let files = [];
      for (let i = 0; i < req.files.length; ++i) {
        files.push(req.files[i].path);
      }

      res.end(files.toString());
    }

  }

  /**************** END : files related ****************/

}


//expose class
module.exports = Xapi;

