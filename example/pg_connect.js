var pg = require('pg');
var lp = require('../lib/');
var moment = require('moment');

// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
var config = {
    database: 'gl_lti_development', //env var: PGDATABASE
    user: 'canvas', //env var: PGUSER
    password: 'canvas', //env var: PGPASSWORD
    host: 'localhost', // Server hosting the postgres database
    port: 5432, //env var: PGPORT
    max: 10, // max number of clients in the pool
    idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
};


//this initializes a connection pool
//it will keep idle connections open for a 30 seconds
//and set a limit of maximum 10 idle clients
var pool = new pg.Pool(config);

// to run a query we can acquire a client from the pool,
// run a query on the client, and then return the client to the pool
pool.connect(function(err, client, done) {
    if(err) {
        return console.error('error fetching client from pool', err);
    }
    var NO_OF_BUFFER_DAYS = 30;
    var date = new Date();
    date.setDate(date.getDate() + NO_OF_BUFFER_DAYS );
    var current_date = moment(date).format('YYYY-MM-DD');

    console.log('executing the query to find public profile url');
    var sql_query = "select id, public_profile_url from user_linkedin_profiles " +
        "where profile_status!='opted_out' AND scraped_on is null " +
        "OR DATE(scraped_on) < '" + current_date + "' " +
        "ORDER BY created_at DESC limit 1";

    query = client.query(sql_query);
    query.on("row", function (row) {
        //url = row.public_profile_url;
        function call(row) {
            lp(row.public_profile_url, function(err, data){

                console.log("updating data for row id - " + row.id);
                if (err) {
                    // error observed while scraping profile
                    var current_time = new Date();
                    var update_query = 'UPDATE user_linkedin_profiles SET scraped_on=$1, scraped_status=$2 WHERE id=$3';
                    client.query(update_query, [current_time, 'failed', row.id], function(err1, result) {
                        if(err1) //handle error
                            console.log("error while updating");
                        else {
                            console.log("updated data");
                        }
                    });
                }
                else {
                    // update the record with data
                    var current_time = new Date();
                    var update_query = 'UPDATE user_linkedin_profiles SET scraper_json=$1, scraped_on=$2, scraped_status=$3 WHERE id=$4';
                    client.query(update_query, [data, current_time,'passed',row.id], function(err1, result) {
                        if(err1) //handle error
                            console.log("error while updating " + err1);
                        else {
                            console.log("updated the data");
                        }
                    });
                }
            });
        }
        call(row);
    });

    query.on('end', function(result) {
        //fired once and only once, after the last row has been returned and after all 'row' events are emitted
        //in this example, the 'rows' array now contains an ordered set of all the rows which we received from postgres
        console.log(result.rowCount + ' rows were received. Done....');
    })
});

pool.on('error', function (err, client) {
    // if an error is encountered by a client while it sits idle in the pool
    // the pool itself will emit an error event with both the error and
    // the client which emitted the original error
    // this is a rare occurrence but can happen if there is a network partition
    // between your application and the database, the database restarts, etc.
    // and so you might want to handle it and at least log it out
    console.error('idle client error', err.message, err.stack)
});