// ==UserScript==
// @name        SFDCTaskScrapingInner
// @namespace   https://sa.kazutan.info
// @version     0.1
// ==/UserScript==

console.log('Check if the script is loaded successfully. (Inner)');

AWS.config.update({
    region: 'us-west-2',
    endpoint: 'http://localhost:8000',
    accessKeyId: '@kazunoh is the best solution architect in the world',
    secretAccessKey: 'You can say that again!'
});

let docClient = new AWS.DynamoDB.DocumentClient();

async function realProcess(xhr) {
    const sURL = 'https://aws-crm.lightning.force.com/aura?r=';
    const eURL = '&ui-analytics-reporting-runpage.ReportPage.runReport=1';
    var tasks = [];
    if (xhr.responseURL.startsWith(sURL) && xhr.responseURL.endsWith(eURL)) {

        const notification_url = new NotificationUrl(notification_new_url);

        console.log('processing:' + xhr.responseURL);

        const data = JSON.parse(xhr.responseText)['actions'][0]['returnValue']['factMap'];
        var keys = Object.keys(data);
        console.log(keys);
        console.log(xhr.responseText);
        
        for (var j in keys) {
            if (data[keys[j]]['rows']) {
                for (var i in data[keys[j]]['rows']) {
                    // Region
                    const subregion = data[keys[j]]['rows'][i]['dataCells'][0]['label']

                    // Opportunity Owner
                    const oppowner = data[keys[j]]['rows'][i]['dataCells'][1]['label'];

                    // Opportunity Name
                    const oppname = data[keys[j]]['rows'][i]['dataCells'][2]['label'];

                    // Close date
                    const closedate = data[keys[j]]['rows'][i]['dataCells'][3]['label'];

                    // Total opp
                    const totalopp = data[keys[j]]['rows'][i]['dataCells'][4]['label'];

                    // Next step
                    const nextstep = data[keys[j]]['rows'][i]['dataCells'][5]['label'];

                    // Next step updated
                    const nextstepupdated = data[keys[j]]['rows'][i]['dataCells'][6]['label'];

                    console.log(subregion, "|", oppowner, "|", oppname, "|", closedate, "|", totalopp, "|", nextstep, "|", nextstepupdated);
                    
                    try {
                        let task = new Task(subregion, oppowner, oppname, totalopp, notification_url, GM_xmlhttpRequest);

                        // send task to slack
                        task.notifyNewTask();

                    } catch(e) {
                        console.log(e);
                        continue;
                    }
                }
               
            }
        
        }
        
        console.log('end of result')
    }
}

class NotificationUrl {
    constructor(notification_new_url) {
        this.notification_new_url = notification_new_url;
    }
}

class Task {
    constructor(subregion, oppowner, oppname, totalopp, notification_url, xhr) {
        this.subregion = subregion;
        this.oppowner = oppowner;
        this.oppname = oppname;
        this.totalopp = totalopp;

        this.notification_url = notification_url;

        this.xhr = xhr;

        this.ttl = 0;
    }
    
    notifyNewTask() {
        this.notify(this.notification_url.notification_new_url);
    }
    
    notify(slack_url) {
        const data = {
            subregion: this.subregion,
            oppowner: this.oppowner,
            oppname: this.oppname,
            totalopp: this.totalopp,
        };

        this.xhr({
            method: 'POST',
            url: slack_url,
            data: JSON.stringify(data)
        });


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
