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
                        .center([0, 34.0])
                        .rotate([112, 0,0])
                        .parallels([33, 45])
                        .scale(3500)
                        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
               .projection(projection);
    //
    //use Promise.all to parallelize asynchronous data loading
    var promises = []
    promises.push(d3.csv("data/Data.csv"));  //load attributes from csv
    promises.push(d3.json("data/arizona-counties.topojson")); //load choropleth spatial data
    promises.push(d3.json("data/states.topojson")); //load choropleth spatial data
    promises.push(d3.json("data/mexico.topojson")); //load choropleth spatial data


    Promise.all(promises).then(callback);
//callback function
    function callback(data){
        var csvData = data[0],
            arizona =  data[1],
            states = data[2],
            mexico = data[3];
       //translate TopoJSON
        var arizonacounties = topojson.feature(arizona, arizona.objects.cb_2015_arizona_county_20m),
            stateboundaries = topojson.feature(states, states.objects.states),
            mexicoboundaries = topojson.feature(mexico, mexico.objects.mexico);
        
        //variables for data join
        var attrArray = ["Population", "% Less Than 18 Years of Age", "% 65 and Over", "Age", "Life Expectancy"]

        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.FIPS; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<arizonacounties.features.length; a++){

                var geojsonProps = arizonacounties.features[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.FIPS; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
            
            console.log(arizonacounties);
        };




   
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path") //append path element to the svg as a child of map
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path); //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines


        //add state boundaries to map
        var states = map.append("path")
            .datum(stateboundaries)
            .attr("class", "states")
            .attr("d", path);

        //add mexico to map
        var mexico = map.append("path")
            .datum(mexicoboundaries)
            .attr("class", "mexico")
            .attr("d", path);


        //add Arizona counties to map
        var counties = map.selectAll(".counties")
            .data(arizonacounties.features)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "counties " + d.properties.FIPS;
            })
            .attr("d", path);


    }

};