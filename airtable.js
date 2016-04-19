var Airtable = require('airtable');
var _ = require('lodash');
var moment = require('moment');
var url = require('url');

var base = new Airtable({ apiKey: 'key17NmuWZ9bLJULJ' }).base('appobZf0deQKJjEv9');

var forcedNames = {
  'eplaya.burningman.org': 'ePlaya',
  'www.reddit.com': 'Reddit',
  'playadiva.wordpress.com': 'Playa Diva',
  'burningtribe.com': 'The Tribe',
  'www.burn.life': 'burn.life',
  'dave.radparvar.com': 'a blog',
};

process('products', 'reviews');
// process('advice', 'advicePosts');

function process(itemTable, subitemTable) {
  getTable(itemTable, function(items) {
    // Assume that advice and products are in different tables.
    var itemType = '';
    if (itemTable == 'products') {
      itemType = 'product';
    }
    else if(itemTable == 'advice') {
      itemType = 'advice';
    }

    if (itemType == 'product') {
      processProducts(items);
    }

    getTable(subitemTable, function(subitems) {
      // Give ech subitem a domain.
      _.each(subitems, function(subitem) {
        var domain = url.parse(subitem.links).host;
        var friendlyDomain = forcedNames[domain] ? forcedNames[domain] : domain;
        subitem.source = friendlyDomain;
      });

      // Replace id references with their actual data.
      var subitemsIndex = _.groupBy(subitems, 'airtableId');
      _.each(items, function(item) {
        item.subitems = _.map(item.subitems, function(subitemId) {
          return subitemsIndex[subitemId][0];
        });
      });

      // Sort by the number of subitems.
      items = _.sortBy(items, function(item) {
        return item.subitems.length;
      });
      items = _.reverse(items);

      // Create a list of information sources.
      _.each(items, function(item) {
        var sources = _.map(item.subitems, 'domain');
        sources = _.uniq(sources);
        item.allReviewSources = sources;
      });

      // Do subitem-specific processing.
      if (itemType == 'product') {
        processReviews(items, subitems);
      }
      else if(itemType == 'advice') {

      }

      console.log(JSON.stringify(items, 0, 2));
    });
  });
}

//
// Item type: product
// Subitem type: review
//

function processProducts(items) {
  // Combine all images.
  _.each(items, function(item) {
    item.images = [
      item.image0,
      item.image1,
      item.image2,
      item.image3,
      item.image4,
    ];

    delete item.image0;
    delete item.image1;
    delete item.image2;
    delete item.image3;
    delete item.image4;
  });
}

function processReviews(items, subitems) {
  // Create a review histogram for each item.
  var allStatements = [];
  _.each(items, function(item) {
    var statements = _.map(item.subitems, 'statements');
    statements = _.compact(_.flattenDeep(statements));
    var histogram = _.countBy(statements, _.identity);
    var histogramArray = [];
    _.each(histogram, function(value, statement) {
      histogramArray.push({
        text: statement,
        count: histogram[statement],

      });
    });
    item.subitemHistogram = histogramArray;
  });

  // Make each element of each statement histogram attribute sources.
  _.each(items, function(item) {
    _.each(item.subitemHistogram, function(subitemSummary) {
      var subitemsWithStatement = _.filter(item.subitems, function(subitem) {
        if (!subitem.statements) {
          return false;
        }
        return subitem.statements.indexOf(subitemSummary.text) !== -1;
      });
      var sources = _.map(subitemsWithStatement, function(subitem) {
        var domain = url.parse(subitem.link).host;
        return forcedNames[domain] ? forcedNames[domain] : domain;
      });
      sources = _.uniq(sources);
      subitemSummary.sources = sources;
    });
  });
}

//
// Item type: advice
// Subitem type: post
//

// Nothing here yet.

//
// Airtable utility functions.
//

function getTable(table, done) {
  base(table).select({
    // Selecting the first 3 records in Main View:
    maxRecords: 50,
    view: "Main View"
  }).eachPage(function page(records, fetchNextPage) {

    records = _.map(records, function(record) {
      // Get the raw json data, plus the table id.
      var obj = _.clone(record.fields);
      obj.airtableId = record.id;
      return obj;
    });

    done(records);

  }, function done(error) {
    if (error) {
      console.log(error);
    }
  });
}
