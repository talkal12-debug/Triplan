/**
 * The cities the world catalogue covers: the places people actually travel to,
 * roughly the top tourist cities per country. This is a selection, not data:
 * every fact about a city (centre, bounding box, names in each language) is
 * resolved on OpenStreetMap by scripts/build-world.ts, and every attraction
 * comes from OpenStreetMap, Wikidata and Wikipedia. Demo countries (PT, IT, JP)
 * list only the cities their hand-curated seed does not have.
 *
 * `q` overrides the Nominatim query when the English name is ambiguous.
 */
export type WorldCitySpec = { cc: string; en: string; q?: string; area?: boolean };

/** Destinations that are an island or a region, not a town of that name: resolution prefers the area. */
export const AREA_DESTINATIONS = new Set(["Ibiza", "Santorini", "Mykonos", "Crete", "Corfu", "Bali", "Lombok", "Palawan", "Boracay", "Langkawi", "Koh Samui", "Goa", "Lake Como", "Cinque Terre", "Cappadocia", "Zanzibar", "Jeju"]);

const c = (cc: string, ...names: (string | [string, string])[]): WorldCitySpec[] =>
  names.map((n) => {
    const spec: WorldCitySpec = typeof n === "string" ? { cc, en: n } : { cc, en: n[0], q: n[1] };
    if (AREA_DESTINATIONS.has(spec.en)) spec.area = true;
    return spec;
  });

export const worldCities: WorldCitySpec[] = [
  // Western Europe
  ...c("FR", "Paris", "Nice", "Lyon", "Marseille", "Bordeaux", "Strasbourg", "Toulouse", "Lille", "Montpellier", "Avignon", "Cannes", "Annecy", "Colmar", "Aix-en-Provence"),
  ...c("ES", "Barcelona", "Madrid", "Seville", "Valencia", "Granada", "Malaga", "Bilbao", "San Sebastian", "Palma", "Cordoba", "Toledo", "Salamanca", "Santiago de Compostela", "Ibiza", "Zaragoza"),
  ...c("GB", "London", "Edinburgh", "Manchester", "Liverpool", "Bath", "Oxford", "Cambridge", "York", "Glasgow", "Bristol", "Brighton", "Belfast", "Cardiff", "Inverness"),
  ...c("DE", "Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Dresden", "Heidelberg", "Nuremberg", "Leipzig", "Stuttgart", "Dusseldorf", "Rothenburg ob der Tauber"),
  ...c("NL", "Amsterdam", "Rotterdam", "Utrecht", "The Hague", "Haarlem", "Delft", "Maastricht"),
  ...c("BE", "Brussels", "Bruges", "Ghent", "Antwerp"),
  ...c("AT", "Vienna", "Salzburg", "Innsbruck", "Hallstatt", "Graz"),
  ...c("CH", "Zurich", "Geneva", "Lucerne", "Interlaken", "Bern", "Lausanne", "Zermatt", "Basel"),
  ...c("IE", "Dublin", "Galway", "Cork", "Killarney"),
  ...c("LU", "Luxembourg"),
  ...c("MC", "Monaco"),
  // Demo countries: cities beyond the hand-curated seed
  ...c("IT", "Florence", "Venice", "Naples", "Verona", "Bologna", "Turin", "Genoa", "Palermo", "Catania", "Pisa", "Siena", "Sorrento", "Amalfi", ["Lake Como", "Bellagio"], "Matera", "Bari", "Lecce", "Cinque Terre", "Cagliari", "Taormina"),
  ...c("PT", "Faro", "Lagos", "Funchal", "Coimbra", "Braga", "Evora", "Aveiro", "Ponta Delgada", "Nazare"),
  ...c("JP", "Kyoto", "Osaka", "Hiroshima", "Nara", "Sapporo", "Fukuoka", "Nagoya", "Kanazawa", "Naha", "Nikko", "Yokohama", "Kobe", "Takayama"),
  // Nordics and Baltics
  ...c("DK", "Copenhagen", "Aarhus", "Odense"),
  ...c("SE", "Stockholm", "Gothenburg", "Malmo"),
  ...c("NO", "Oslo", "Bergen", "Tromso", "Stavanger"),
  ...c("FI", "Helsinki", "Rovaniemi", "Turku"),
  ...c("IS", "Reykjavik"),
  ...c("EE", "Tallinn"),
  ...c("LV", "Riga"),
  ...c("LT", "Vilnius"),
  // Central and Eastern Europe
  ...c("CZ", "Prague", "Cesky Krumlov", "Brno"),
  ...c("HU", "Budapest"),
  ...c("PL", "Krakow", "Warsaw", "Gdansk", "Wroclaw"),
  ...c("SK", "Bratislava"),
  ...c("SI", "Ljubljana", "Bled"),
  ...c("HR", "Dubrovnik", "Split", "Zagreb", "Zadar", "Hvar", "Rovinj"),
  ...c("BA", "Sarajevo", "Mostar"),
  ...c("ME", "Kotor", "Budva"),
  ...c("RS", "Belgrade"),
  ...c("RO", "Bucharest", "Brasov", "Cluj-Napoca", "Sibiu"),
  ...c("BG", "Sofia", "Plovdiv", "Varna"),
  ...c("GR", "Athens", "Thessaloniki", "Santorini", "Mykonos", "Rhodes", "Crete", "Corfu", "Nafplio"),
  ...c("CY", "Paphos", "Limassol", "Larnaca", "Ayia Napa"),
  ...c("MT", "Valletta"),
  ...c("TR", "Istanbul", "Antalya", "Cappadocia", "Izmir", "Bodrum", "Fethiye"),
  ...c("GE", "Tbilisi", "Batumi"),
  ...c("AM", "Yerevan"),
  // Middle East and North Africa
  ...c("IL", "Jerusalem", "Tel Aviv", "Haifa", "Eilat"),
  ...c("JO", "Amman", "Petra", "Aqaba"),
  ...c("AE", "Dubai", "Abu Dhabi"),
  ...c("QA", "Doha"),
  ...c("OM", "Muscat"),
  ...c("EG", "Cairo", "Luxor", "Sharm El Sheikh", "Hurghada", "Alexandria"),
  ...c("MA", "Marrakesh", "Fez", "Casablanca", "Chefchaouen", "Tangier", "Rabat"),
  ...c("TN", "Tunis"),
  // Africa
  ...c("ZA", "Cape Town", "Johannesburg", "Durban"),
  ...c("KE", "Nairobi", "Mombasa"),
  ...c("TZ", "Zanzibar", "Arusha"),
  ...c("ET", "Addis Ababa"),
  ...c("MU", "Port Louis"),
  ...c("SC", "Victoria"),
  // Asia
  ...c("TH", "Bangkok", "Chiang Mai", "Phuket", "Krabi", "Pattaya", "Koh Samui"),
  ...c("VN", "Hanoi", "Ho Chi Minh City", "Hoi An", "Da Nang", "Hue"),
  ...c("KH", "Siem Reap", "Phnom Penh"),
  ...c("LA", "Luang Prabang"),
  ...c("MY", "Kuala Lumpur", "Penang", "Langkawi", "Malacca"),
  ...c("SG", "Singapore"),
  ...c("ID", "Bali", "Jakarta", "Yogyakarta", "Lombok"),
  ...c("PH", "Manila", "Cebu", "Boracay", "Palawan"),
  ...c("KR", "Seoul", "Busan", "Jeju"),
  ...c("CN", "Beijing", "Shanghai", "Xi'an", "Guilin", "Chengdu", "Hangzhou"),
  ...c("HK", "Hong Kong"),
  ...c("MO", "Macau"),
  ...c("TW", "Taipei", "Kaohsiung", "Tainan"),
  ...c("IN", "Delhi", "Mumbai", "Jaipur", "Agra", "Goa", "Udaipur", "Varanasi", "Kochi", "Bangalore", "Kolkata"),
  ...c("LK", "Colombo", "Kandy", "Galle"),
  ...c("NP", "Kathmandu", "Pokhara"),
  ...c("MV", "Male"),
  ...c("UZ", "Samarkand", "Bukhara", "Tashkent"),
  ...c("KZ", "Almaty"),
  // Oceania
  ...c("AU", "Sydney", "Melbourne", "Brisbane", "Perth", "Cairns", "Gold Coast", "Adelaide", "Hobart"),
  ...c("NZ", "Auckland", "Queenstown", "Wellington", "Christchurch", "Rotorua"),
  ...c("FJ", "Nadi"),
  // North America
  ...c("US", "New York", "Los Angeles", "San Francisco", "Las Vegas", "Miami", "Chicago", "Washington", "Boston", "Orlando", "New Orleans", "Seattle", "San Diego", "Nashville", "Austin", "Honolulu", "Philadelphia", "Denver", "Savannah", "Charleston", "Portland", "Santa Fe", "Palm Springs", "Key West"),
  ...c("CA", "Toronto", "Vancouver", "Montreal", "Quebec City", "Ottawa", "Calgary", "Banff", "Victoria", "Halifax"),
  ...c("MX", "Mexico City", "Cancun", "Oaxaca", "Guadalajara", "Playa del Carmen", "Tulum", "San Miguel de Allende", "Puerto Vallarta", "Merida"),
  ...c("CU", "Havana", "Trinidad", "Varadero"),
  ...c("DO", "Punta Cana", "Santo Domingo"),
  ...c("JM", "Montego Bay", "Kingston"),
  ...c("CR", "San Jose", "La Fortuna", "Manuel Antonio"),
  ...c("PA", "Panama City"),
  ...c("GT", "Antigua Guatemala"),
  ...c("BS", "Nassau"),
  ...c("PR", ["San Juan", "San Juan, Puerto Rico"]),
  // South America
  ...c("BR", "Rio de Janeiro", "Sao Paulo", "Salvador", "Florianopolis", "Foz do Iguacu", "Recife"),
  ...c("AR", "Buenos Aires", "Mendoza", "Bariloche", "Salta", "Ushuaia"),
  ...c("CL", "Santiago", "Valparaiso", "San Pedro de Atacama", "Puerto Varas"),
  ...c("PE", "Lima", "Cusco", "Arequipa"),
  ...c("CO", "Cartagena", "Bogota", "Medellin"),
  ...c("EC", "Quito", "Cuenca"),
  ...c("BO", "La Paz"),
  ...c("UY", "Montevideo", "Punta del Este"),
];
