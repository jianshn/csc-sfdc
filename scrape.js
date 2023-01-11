// ==UserScript==
// @name        SFDCTaskScrapingInner
// @namespace   https://sa.kazutan.info
// @version     0.1
// ==/UserScript==

console.log('Check if the script is loaded successfully. (Inner)');

AWS.config.update({
    region: 'ap-southeast-1',
    endpoint: 'http://localhost:8000',
    accessKeyId: 'jasonng',
    secretAccessKey: 'jasonngisthebest'
});

let docClient = new AWS.DynamoDB.DocumentClient();

async function realProcess(xhr) {
    const sURL = 'https://aws-crm.lightning.force.com/aura?r=';
    const eURL = '&ui-analytics-reporting-runpage.ReportPage.runReport=1';
    var tasks = [];
    if (xhr.responseURL.startsWith(sURL) && xhr.responseURL.endsWith(eURL)) {

        const notification_url = new NotificationUrl(notification_new_url, notification_co_url);

        console.log('processing:' + xhr.responseURL);

        const data = JSON.parse(xhr.responseText)['actions'][0]['returnValue']['factMap'];
        var keys = Object.keys(data);
        console.log(keys);
        
        var tmp_list = [];

        for (var j in keys) {
            if (data[keys[j]]['rows']) {
                for (var i in data[keys[j]]['rows']) {
                    // Region
                    const subregion = data[keys[j]]['rows'][i]['dataCells'][0]['label']

                    // Opportunity Owner
                    const oppowner = data[keys[j]]['rows'][i]['dataCells'][1]['label'];

                    // Opportunity Name
                    const oppname = data[keys[j]]['rows'][i]['dataCells'][2]['label'];
                    
                    // Opp Salesforce Id
                    const opp_sfdcid = data[keys[j]]['rows'][i]['dataCells'][2]['recordId'];

                    // Close date
                    const closedate = data[keys[j]]['rows'][i]['dataCells'][3]['label'];

                    // Total opp
                    const totalopp = data[keys[j]]['rows'][i]['dataCells'][4]['label'];

                    // Next step
                    const nextstep = data[keys[j]]['rows'][i]['dataCells'][5]['label'];

                    // Next step updated
                    const nextstepupdated = data[keys[j]]['rows'][i]['dataCells'][6]['label'];
                    
                    // Member create date
                    const membercreatedate = data[keys[j]]['rows'][i]['dataCells'][7]['label'];

                    console.log(subregion, "|", oppowner, "|", oppname, "|", opp_sfdcid, "|", closedate, "|", totalopp, "|", nextstep, "|", nextstepupdated, "|", membercreatedate);
                    
                    try {
                        let task = new Task(subregion, oppowner, oppname, opp_sfdcid, totalopp, membercreatedate, notification_url, GM_xmlhttpRequest);
                        
                        // Append opp id to list
                        tmp_list.push(opp_sfdcid)

                        // send task to slack
                        if (oppname.includes("[CO]")){
                            task.notifyCOTask();
                        } else {
                            task.notifyNewTask();
                        }

                    } catch(e) {
                        console.log(e);
                        continue;
                    }
                }
               
            }
        
        }
        
        console.log(tmp_list);
        tmp_list.push('006234asdasf789243');
        console.log('Get ddb items');
        let ddbItems = await opp_more_than_one_hour();
        console.log(ddbItems);
        console.log('finished getting items');
        
        // insert item in ddb if present for the first time in sfdc
        try {
            const new_sfdc_item = String(tmp_list.filter(element => !ddbItems.ddb_sfdc_list.includes(element))).split(",");
            console.log(new_sfdc_item);
            while ( i < new_sfdc_item.length ) {
                console.log('new_item: ' + new_sfdc_item[i])
                await insertToDB(new_sfdc_item[i], 0)
                i++
            }
        } catch(e) {
            console.log(e);
        }
        
        // compare opp in tmp list to ddb table, add time if present, 0 = sfdc_id, 1 = time_in_sfdc
        while (i < ddbItems.ddb_list.length) {
            console.log(ddbItems.ddb_list[i][0]);
            console.log(tmp_list);

            i++;
        }

        console.log('end of result')
    }
}

class NotificationUrl {
    constructor(notification_new_url, notification_co_url) {
        this.notification_new_url = notification_new_url;
        this.notification_co_url = notification_co_url;
    }
}

async function opp_more_than_one_hour() {
    const params = {
        TableName: 'Test'
    };
    const result = await docClient.scan(params).promise().then((data) => {return data})
    
    var ddb_list = [];
    var ddb_sfdc_list = []
    console.log(result)

    result.Items.forEach(function (element, index, array) {
        console.log(
            "printing",
            element['sfdc_id']
        );  
        ddb_list.push([element['sfdc_id'], element['time_in_sfdc']]);
        ddb_sfdc_list.push(element['sfdc_id']);
      });
    
    return {ddb_list, ddb_sfdc_list};
}

async function insertToDB(id, time) {
    const params = {
        TableName: 'Test',
        Item: {
            'sfdc_id': id,
            'time_in_sfdc': time
        }
    };
    const result = await docClient.put(params).promise();
}

async function updateToDB(id, time) {
    const params = {
        TableName: 'Test',
        Key: {
            'sfdc_id': id,
        },
        UpdateExpression: 'set time_in_sfdc = :val1',
        ExpressionAttributeValues: {
            ':val1': time
        }
    };
    const result = await docClient.update(params).promise();
}

class Task {
    constructor(subregion, oppowner, oppname, opp_sfdcid, totalopp, membercreatedate, notification_url, xhr) {
        this.subregion = subregion;
        this.oppowner = oppowner;
        this.oppname = oppname;
        this.opp_sfdcid = "https://aws-crm.lightning.force.com/lightning/r/Report/" + opp_sfdcid + "/view";
        this.totalopp = totalopp;
        this.membercreatedate = membercreatedate

        this.notification_url = notification_url;

        this.xhr = xhr;

        this.ttl = 0;
    }
    
    notifyNewTask() {
        this.notify(this.notification_url.notification_new_url);
    }
    
    notifyCOTask() {
        this.notify(this.notification_url.notification_co_url);
    }
    
    notify(slack_url) {
        const data = {
            subregion: this.subregion,
            oppowner: this.oppowner,
            oppname: this.oppname,
            opp_sfdcid: this.opp_sfdcid,
            totalopp: this.totalopp,
            membercreatedate: this.membercreatedate
        };

        this.xhr({
            method: 'POST',
            url: slack_url,
            data: JSON.stringify(data)
        });

        console.log(slack_url)
        console.log('sent a task to slack.');
    }

}

function hijackAjax(process) {
    if(typeof process != 'function') {
        process = function(e){ console.log(e); };
    }
    window.addEventListener('hijack_ajax', function(event) {
        process(event.detail);
    }, false);
    function injection() {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener('load', function() {
                window.dispatchEvent(new CustomEvent('hijack_ajax', {detail: this}));
            }, false);
            open.apply(this, arguments);
        };
    }
    window.setTimeout('(' + injection.toString() + ')()', 0);
}
