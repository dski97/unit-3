(function() {
    // Attribute array and expressed variables
    var attrArray = ["Population", "% Less Than 18 Years of Age", "% 65 and Over", "Age", "Life Expectancy"];
    var expressed = attrArray[0];
    var colorScale;

    // Begin script when window loads
    window.onload = setMap();

    // Set up choropleth map
    function setMap() {
        // Map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;

        // Create new svg container for the map
        var map = d3.select("body")
                    .append("svg")
                    .attr("class", "map")
                    .attr("width", width)
                    .attr("height", height);

        // Create Albers equal area conic projection centered on Arizona
        var projection = d3.geoAlbers()
                            .center([0, 34.0])
                            .rotate([112, 0, 0])
                            .parallels([33, 45])
                            .scale(3500)
                            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
                     .projection(projection);

        // Use Promise.all to parallelize asynchronous data loading
        var promises = [];
        promises.push(d3.csv("data/Data.csv")); // Load attributes from csv
        promises.push(d3.json("data/arizona-counties.topojson")); // Load choropleth spatial data
        promises.push(d3.json("data/states.topojson")); // Load choropleth spatial data
        promises.push(d3.json("data/mexico.topojson")); // Load choropleth spatial data

        Promise.all(promises).then(data => callback(data, map, path));
    }

    // Callback function
    function callback(data, map, path) {
        var csvData = data[0],
            arizona = data[1],
            states = data[2],
            mexico = data[3];

        // Translate TopoJSON
        var arizonacounties = topojson.feature(arizona, arizona.objects.cb_2015_arizona_county_20m),
            stateboundaries = topojson.feature(states, states.objects.states),
            mexicoboundaries = topojson.feature(mexico, mexico.objects.mexico);

        processData(csvData, arizonacounties);
        createGraticule(map, path);
        addStateBoundaries(map, path, stateboundaries);
        addMexico(map, path, mexicoboundaries);
        makeColorScale(csvData);
        setEnumerationUnits(arizonacounties, csvData, map, path);
        setChart(csvData, colorScale);
    }

    // Process data
    function processData(csvData, arizonacounties) {
        for (var i = 0; i < csvData.length; i++) {
            var csvRegion = csvData[i]; // The current region
            var csvKey = csvRegion.FIPS; // The CSV primary key

            for (var a = 0; a < arizonacounties.features.length; a++) {
                var geojsonProps = arizonacounties.features[a].properties; // The current region geojson properties
                var geojsonKey = geojsonProps.FIPS; // The geojson primary key

                // Where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {
                    attrArray.forEach(function(attr) {
                        var val = parseFloat(csvRegion[attr]); // Get csv attribute value
                        geojsonProps[attr] = val; // Assign attribute and value to geojson properties
                    });
                }
            }
        }
        console.log(arizonacounties);
    }

    // Create graticule
    function createGraticule(map, path) {
        var graticule = d3.geoGraticule()
            .step([5, 5]); // Place graticule lines every 5 degrees of longitude and latitude

        var gratBackground = map.append("path") // Append path element to the svg as a child of map
            .datum(graticule.outline()) // Bind graticule background
            .attr("class", "gratBackground") // Assign class for styling
            .attr("d", path); // Project graticule

        var gratLines = map.selectAll(".gratLines") // Select graticule elements that will be created
            .data(graticule.lines()) // Bind graticule lines to each element to be created
            .enter() // Create an element for each datum
            .append("path") // Append each element to the svg as a path element
            .attr("class", "gratLines") // Assign class for styling
            .attr("d", path); // Project graticule lines
    }

    // Add state boundaries
    function addStateBoundaries(map, path, stateboundaries) {
        map.append("path")
            .datum(stateboundaries)
            .attr("class", "states")
            .attr("d", path);
    }

    // Add Mexico
    function addMexico(map, path, mexicoboundaries) {
        map.append("path")
            .datum(mexicoboundaries)
            .attr("class", "mexico")
            .attr("d", path);
    }

    // Add Arizona counties
    function addArizonaCounties(map, path, arizonacounties) {
        map.selectAll(".counties")
            .data(arizonacounties.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "counties " + d.properties.FIPS;
            })
            .attr("d", path);
    }

    //function to create color scale generator
    function makeColorScale(data) {
        var colorClasses = [
            "#ffedf2",
            "#fcbba1",
            "#fc9272",
            "#fb6a4a",
            "#ef3b2c",
            "#cb181d"
        ];
        
        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        }

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 6);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d) {
            return d3.min(d);
        });

        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 5 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    }

    //function to set enumeration units fill color
    function setEnumerationUnits(arizonacounties, csvData, map, path) {

        var colorScale = makeColorScale(csvData);

        //add Arizona counties to map
        var counties = map.selectAll(".counties")
            .data(arizonacounties.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "counties " + d.properties.FIPS;
            })
            .attr("d", path)
                .style("fill", function(d) {
                    var value = d.properties[expressed];
                    if (value) {
                        return colorScale(value);
                    } else {
                        return "#ccc";
                    }
                });
    }

    //function to create coordinated bar chart
    function setChart(csvData, colorScale) {
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 460;

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
    };
})();
