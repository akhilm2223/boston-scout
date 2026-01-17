// MBTA Static Track GeoJSON - "Vascular Foundation" of Boston
// These are the permanent rail arteries - geometry doesn't change, only alerts affect visibility

export const MBTA_STATIC_TRACKS: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        // ====================================
        // WORCESTER LINE (Commuter Rail) - WPI Connection
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'CR-Worcester',
                routeName: 'Worcester Line',
                color: '#80276C', // Official MBTA Purple
                textColor: '#FFFFFF',
                type: 2, // Commuter Rail
                isWpiRoute: true,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.798547, 42.262046], // Worcester Union Station
                    [-71.784612, 42.267891], // Grafton
                    [-71.731234, 42.283456], // Westborough
                    [-71.686543, 42.296789], // Southborough
                    [-71.642187, 42.317654], // Ashland
                    [-71.549832, 42.286543], // Framingham
                    [-71.461234, 42.322876], // Natick
                    [-71.381234, 42.303456], // Wellesley Square
                    [-71.303456, 42.326789], // Wellesley Hills
                    [-71.264532, 42.331234], // Newton Highlands
                    [-71.231456, 42.337654], // Newtonville
                    [-71.191234, 42.351876], // West Newton
                    [-71.152345, 42.352987], // Auburndale
                    [-71.127654, 42.351234], // Brighton
                    [-71.099876, 42.350543], // Boston Landing
                    [-71.077654, 42.347321], // Yawkey
                    [-71.054276, 42.351706], // Back Bay
                    [-71.055242, 42.366413], // South Station
                ],
            },
        },
        // ====================================
        // RED LINE
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Red',
                routeName: 'Red Line',
                color: '#DA291C', // Official MBTA Red
                textColor: '#FFFFFF',
                type: 1, // Heavy Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.087589, 42.395428], // Alewife
                    [-71.077257, 42.395980], // Davis
                    [-71.071098, 42.393771], // Porter
                    [-71.118956, 42.373364], // Harvard
                    [-71.103802, 42.365486], // Central
                    [-71.092158, 42.362590], // Kendall/MIT
                    [-71.087589, 42.361164], // Charles/MGH
                    [-71.062424, 42.356239], // Park Street
                    [-71.057598, 42.352547], // Downtown Crossing
                    [-71.055242, 42.352271], // South Station
                    [-71.056967, 42.342622], // Broadway
                    [-71.064486, 42.330154], // Andrew
                    [-71.083543, 42.320685], // JFK/UMass
                    [-71.101391, 42.275275], // Quincy Center (Braintree branch)
                    [-71.002200, 42.207800], // Braintree (LOGIC LOCK ANCHOR)
                ],
            },
        },
        // ====================================
        // ORANGE LINE
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Orange',
                routeName: 'Orange Line',
                color: '#ED8B00', // Official MBTA Orange
                textColor: '#000000',
                type: 1, // Heavy Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.088961, 42.436722], // Oak Grove
                    [-71.077082, 42.426632], // Malden Center
                    [-71.073780, 42.418609], // Wellington
                    [-71.067666, 42.401504], // Assembly
                    [-71.069533, 42.392811], // Sullivan Square
                    [-71.063917, 42.374680], // Community College
                    [-71.060225, 42.365577], // North Station
                    [-71.059246, 42.360873], // Haymarket
                    [-71.057598, 42.356239], // State
                    [-71.058798, 42.352547], // Downtown Crossing
                    [-71.061865, 42.348940], // Chinatown
                    [-71.063565, 42.345343], // Tufts Medical
                    [-71.075574, 42.336377], // Back Bay
                    [-71.084452, 42.331316], // Massachusetts Ave
                    [-71.094761, 42.323204], // Ruggles
                    [-71.099595, 42.317062], // Roxbury Crossing
                    [-71.104609, 42.310525], // Jackson Square
                    [-71.112144, 42.300093], // Stony Brook
                    [-71.114165, 42.291698], // Green Street
                    [-71.114119, 42.284523], // Forest Hills
                ],
            },
        },
        // ====================================
        // BLUE LINE
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Blue',
                routeName: 'Blue Line',
                color: '#003DA5', // Official MBTA Blue
                textColor: '#FFFFFF',
                type: 1, // Heavy Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-70.991648, 42.413560], // Wonderland
                    [-70.997123, 42.407843], // Revere Beach
                    [-71.005409, 42.397542], // Beachmont
                    [-71.016549, 42.390501], // Suffolk Downs
                    [-71.030395, 42.386867], // Orient Heights
                    [-71.039101, 42.383975], // Wood Island
                    [-71.047194, 42.374262], // Airport
                    [-71.040002, 42.368756], // Maverick
                    [-71.050311, 42.361166], // Aquarium
                    [-71.057598, 42.356239], // State
                    [-71.059152, 42.361365], // Government Center
                    [-71.062145, 42.363706], // Bowdoin
                ],
            },
        },
        // ====================================
        // GREEN LINE - B Branch
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Green-B',
                routeName: 'Green Line B',
                color: '#00843D', // Official MBTA Green
                textColor: '#FFFFFF',
                type: 0, // Light Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.168500, 42.335900], // Boston College (LOGIC LOCK ANCHOR)
                    [-71.157661, 42.340023], // South Street
                    [-71.150711, 42.339894], // Chestnut Hill Ave
                    [-71.140551, 42.340088], // Chiswick Road
                    [-71.131355, 42.340551], // Sutherland Road
                    [-71.121386, 42.341227], // Packards Corner
                    [-71.115892, 42.349974], // Harvard Ave
                    [-71.107414, 42.349735], // Allston Street
                    [-71.103889, 42.349503], // Warren Street
                    [-71.100323, 42.349253], // Washington Street (Green)
                    [-71.085608, 42.349422], // Boston University East
                    [-71.082070, 42.350082], // Blandford Street
                    [-71.076728, 42.351980], // Kenmore
                    [-71.071028, 42.352104], // Hynes Convention Center
                    [-71.063565, 42.351467], // Copley
                    [-71.063565, 42.356239], // Arlington
                    [-71.062424, 42.356239], // Boylston
                    [-71.062145, 42.356239], // Park Street
                ],
            },
        },
        // ====================================
        // GREEN LINE - C Branch
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Green-C',
                routeName: 'Green Line C',
                color: '#00843D', // Official MBTA Green
                textColor: '#FFFFFF',
                type: 0, // Light Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.149326, 42.331316], // Cleveland Circle
                    [-71.142776, 42.335974], // Englewood Ave
                    [-71.131934, 42.340321], // Dean Road
                    [-71.126894, 42.340801], // Tappan Street
                    [-71.116834, 42.341284], // Washington Square
                    [-71.111501, 42.341661], // Fairbanks Street
                    [-71.106554, 42.342019], // Brandon Hall
                    [-71.099867, 42.342461], // Summit Ave
                    [-71.093894, 42.343054], // Coolidge Corner
                    [-71.084849, 42.344319], // St. Paul Street (Green C)
                    [-71.080994, 42.345583], // Kent Street
                    [-71.076728, 42.351980], // Kenmore
                    [-71.071028, 42.352104], // Hynes
                    [-71.063565, 42.351467], // Copley
                    [-71.063565, 42.356239], // Arlington
                    [-71.062424, 42.356239], // Boylston
                    [-71.062145, 42.356239], // Park Street
                ],
            },
        },
        // ====================================
        // GREEN LINE - D Branch
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Green-D',
                routeName: 'Green Line D',
                color: '#00843D', // Official MBTA Green
                textColor: '#FFFFFF',
                type: 0, // Light Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.259648, 42.332258], // Riverside
                    [-71.243679, 42.331710], // Woodland
                    [-71.230769, 42.326124], // Waban
                    [-71.218547, 42.326547], // Eliot
                    [-71.206123, 42.330876], // Newton Highlands
                    [-71.192878, 42.332501], // Newton Centre
                    [-71.182345, 42.337123], // Chestnut Hill
                    [-71.165234, 42.337721], // Reservoir
                    [-71.149326, 42.337801], // Beaconsfield
                    [-71.129234, 42.340721], // Brookline Hills
                    [-71.116834, 42.343284], // Brookline Village
                    [-71.105502, 42.345234], // Longwood
                    [-71.099867, 42.347461], // Fenway
                    [-71.076728, 42.351980], // Kenmore
                    [-71.071028, 42.352104], // Hynes
                    [-71.063565, 42.351467], // Copley
                    [-71.063565, 42.356239], // Arlington
                    [-71.062424, 42.356239], // Boylston
                    [-71.062145, 42.356239], // Park Street
                ],
            },
        },
        // ====================================
        // GREEN LINE - E Branch
        // ====================================
        {
            type: 'Feature',
            properties: {
                routeId: 'Green-E',
                routeName: 'Green Line E',
                color: '#00843D',
                textColor: '#FFFFFF',
                type: 0, // Light Rail
                isWpiRoute: false,
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-71.110252, 42.300523], // Heath Street
                    [-71.105892, 42.311891], // Back of the Hill
                    [-71.099595, 42.317062], // Mission Park
                    [-71.095234, 42.322987], // Riverway
                    [-71.091234, 42.331234], // Longwood Medical
                    [-71.085234, 42.336721], // Brigham Circle
                    [-71.082876, 42.340721], // Museum of Fine Arts
                    [-71.084234, 42.345234], // Northeastern
                    [-71.085234, 42.348721], // Symphony
                    [-71.084234, 42.350234], // Prudential
                    [-71.063565, 42.351467], // Copley
                    [-71.063565, 42.356239], // Arlington
                    [-71.062424, 42.356239], // Boylston
                    [-71.062145, 42.356239], // Park Street
                ],
            },
        },
    ],
};

// Route colors for reference
export const ROUTE_COLORS: Record<string, string> = {
    'CR-Worcester': '#80276C',
    'Red': '#DA291C',
    'Orange': '#ED8B00',
    'Blue': '#003DA5',
    'Green-B': '#00843D',
    'Green-C': '#00843D',
    'Green-D': '#00843D',
    'Green-E': '#00843D',
};
