//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = 960,
        height = 500;

    //create new svg container for the map
    var map = d3.select("body")
                .append("svg")
                .attr("class", "map")
                .attr("width", width)
                .attr("height", height);

    //create Albers equal area conic projection centered on Arizona
    var projection = d3.geoAlbers()
                        .center([0, 32.5])
                        .rotate([111.5, 0])
                        .parallels([29.5, 45.5])
                        .scale(2500)
                        .translate([width / 2, height / 2]);

    //
    //use Promise.all to parallelize asynchronous data loading
    var promises = [d3.csv("data/Data.csv"),
                    d3.json("data/arizona-counties.topojson")
                   ];
    
    Promise.all(promises).then(callback);

    function callback(data){
        var csvData = data[0],
            arizona =  data[1];
       
        var arizonacounties = topojson.feature(arizona, arizona.objects.cb_2015_arizona_county_20m);
    }

};