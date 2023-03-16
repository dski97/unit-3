(function() {
    // Attribute array and expressed variables
    var attrArray = ["Population", "% Less Than 18 Years of Age", "% 65 and Over", "% rural", "Life Expectancy", "Median Household Income"];
    var expressed = attrArray[0];

    //chart variables
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 460;

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
        var colorScale = makeColorScale(csvData);
        setEnumerationUnits(arizonacounties, csvData, map, path, colorScale);
        setChart(csvData, colorScale);
        createDropdown(csvData);
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
    function setEnumerationUnits(arizonacounties, csvData, map, path, colorScale) {

        var colorScale = makeColorScale(csvData);

        //add Arizona counties to map
        var counties = map.selectAll(".counties")
            .data(arizonacounties.features)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "counties county_" + d.properties.FIPS;
            })
            .attr("d", path)
            .style("fill", function(d) {
                console.log(d);
                var value = d.properties[expressed];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            }) // Close the .style() block here
            .on("mouseover", function(event, d) {
                highlight(d.properties);
            })
            .on('mouseout', function(event, d) {
                dehighlight(d.properties);
            });

        var desc = counties.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
        
    }


    //function to create coordinated bar chart
    function setChart(csvData, colorScale) {

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        var yScale = d3.scaleLinear()
            .range([0, chartHeight])
            .domain([0, 4800000]);


        //set bars for each county
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b) {
                return a[expressed] - b[expressed];
            })
            .attr("class", function(d) {
                return "bars county_" + d.FIPS;
            })
            .attr("width", chartWidth / csvData.length - 1)
            .on("mouseover", function(event, d){
                highlight(d);
            })
            .on("mouseout", function(event, d){
                dehighlight(d);
            })
            .attr("x", function(d, i) {
                return i * (chartWidth / csvData.length);
            })
            .attr("height", function(d) {
                return yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d) {
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .style("fill", function(d) {
                return colorScale(d[expressed]);
            })
        
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');



        var numbers = chart.selectAll(".numbers")
            .data(csvData)
            .enter()
            .append("text")
            .sort(function(a, b) {
                return a[expressed] - b[expressed];
            })
            .attr("class", function(d) {
                return "numbers " + d.FIPS;
            })
            .attr("text-anchor", "middle")
            .attr("x", function(d, i) {
                var fraction = chartWidth / csvData.length;
                return i * fraction + (fraction - 1) / 2;
            })
            .attr("y", function(d) {
                return chartHeight - yScale(parseFloat(d[expressed])) - 5;
            })
            .text(function(d) {
                return d[expressed] > 999999 ? d[expressed].toString().slice(0, -6) + "M" : d[expressed].toString().slice(0, -3) + "K";
            });
        
        var chartTitle = chart.append("text")
            .attr("x", 20)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(getChartTitleText(expressed));
    }

        function highlight(props) {
            var selected = d3.selectAll(".county_" + props.FIPS)
                .style("stroke", "blue")
                .style("stroke-width", "2");
    }

        function dehighlight(props) {
            var selected = d3.selectAll(".county_" + props.FIPS)
                .style("stroke", function() {
                    return getStyle(this, "stroke")
                })
                .style("stroke-width", function() {
                    return getStyle(this, "stroke-width")
                });

                function getStyle(element, styleName) {
                    var styleText = d3.select(element)
                        .select("desc")
                        .text();

                    var styleObject = JSON.parse(styleText);

                    return styleObject[styleName];
                };
    }
    

    //function to get chart title text
    function getChartTitleText(attribute) {
        switch (attribute) {
            case "Population":
                return "Total Population by County, 2022";
            case "% Less Than 18 Years of Age":
                return "Percentage of Population Under 18 Years by County, 2022";
            case "% 65 and Over":
                return "Percentage of Population 65 Years and Over by County, 2022";
            case "% rural":
                return "Percentage of Rural Population by County, 2022";
            case "Life Expectancy":
                return "Life Expectancy by County, 2022";
            case "Median Household Income":
                return "Median Household Income by County, 2022";
            default:
                return "";
        }
    }

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function() {
                changeAttribute(this.value, csvData);
            });


        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d) {
                return d;
            })
            .text(function(d) {
                return d;
            });
    }


//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
    .transition()
    .duration(1000)    
    .style("fill", function(d) {
        var value = d.properties[expressed];
        if (value) {
            return colorScale(d.properties[expressed]);
        } else {
            return "#ccc";
        }
    });

    // Update yScale based on new attribute data
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, d3.max(csvData, d => parseFloat(d[expressed])+ parseFloat(d[expressed]) * 0.2)]);

    // Update the chart title
    d3.select(".chartTitle")
        .text(getChartTitleText(expressed));

    // Update the numbers (text labels) for each bar
    d3.selectAll(".numbers")
        .sort(function(a, b) {
            return a[expressed] - b[expressed];
        })
        .transition()
        .delay(function(d, i) {
            return i * 20;
        })
        .duration(500)
        .attr("class", function(d) {
            return "numbers " + d.FIPS;
        })
        .attr("text-anchor", "middle")
        .attr("x", function(d, i) {
            var fraction = chartWidth / csvData.length;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d) {
            return chartHeight - yScale(parseFloat(d[expressed])) - 5;
        })
        .text(function(d) {
            return formatTextByAttribute(d[expressed], expressed);
        });

    //update text labels depending on correct attribute
    function formatTextByAttribute(value, attribute) {
        if (attribute === "Population" || attribute === "Median Household Income") {
            return value > 999999 ? value.toString().slice(0, -6) + "M" : value.toString().slice(0, -3) + "K";
        } else {
            return value;
        }
    }

    // Update the bars
    d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b) {
            return a[expressed] - b[expressed];
        })
        .transition()
        .delay(function(d, i) {
            return i * 20;
        })
        .duration(500)
        .attr("x", function(d, i) {
            return i * (chartWidth / csvData.length);
        })
        //resize bars
        .attr("height", function(d) {
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d) {
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        //recolor bars
        .style("fill", function(d) {
            var value = d[expressed];
            if (value) {
                return colorScale(value);
            } else {
                return "#ccc";
            }
        });
}

})();
