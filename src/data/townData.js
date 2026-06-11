// Comprehensive town data for Coen Construction service area pages

export const REGIONS = [
  {
    name: "Greater Boston",
    slug: "greater-boston",
    desc: "Boston's inner cities and neighborhoods — from Cambridge to Hyde Park.",
    towns: [
      "Cambridge", "Somerville", "Brookline", "Medford", "Revere", "Everett",
      "Allston", "Brighton", "Charlestown", "East Boston", "Dorchester",
      "South Boston", "Jamaica Plain", "Roslindale", "Hyde Park", "West Roxbury", "Roxbury"
    ]
  },
  {
    name: "Metro West",
    slug: "metro-west",
    desc: "The western suburbs stretching from the Charles River to the Sudbury Valley.",
    towns: [
      "Lexington", "Weston", "Waltham", "Concord", "Lincoln", "Wellesley",
      "Newton", "Medfield", "Millis", "Dedham", "Westwood", "Dover", "Sherborn",
      "Holliston", "Medway", "Ashland", "Hopkinton", "Framingham", "Natick",
      "Wayland", "Sudbury", "Watertown"
    ]
  },
  {
    name: "South Shore",
    slug: "south-shore",
    desc: "Plymouth County and the South Shore coast — from Milton to Plymouth.",
    towns: [
      "Plymouth", "Milton", "Easton", "Sharon", "Stoughton", "Mansfield",
      "Foxborough", "Norfolk", "Walpole", "Norwood", "Canton", "Braintree",
      "Quincy", "Weymouth", "Hanover", "Hingham", "Cohasset", "Scituate",
      "Norwell", "Marshfield", "Duxbury", "Pembroke", "Kingston", "Hull"
    ]
  }
];

export function getRegionForTown(townName) {
  return REGIONS.find(r => r.towns.map(t => t.toLowerCase()).includes(townName.toLowerCase())) || null;
}

export function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

const BASE_SERVICES = ["Home Additions", "Decks & Pergolas", "Siding", "Kitchen Remodeling", "Custom Carpentry", "Snow Removal"];

export const TOWN_DATA = {
  // ─── GREATER BOSTON ───────────────────────────────────────────────
  cambridge: {
    name: "Cambridge", county: "Middlesex County", state: "MA", zip: "02139",
    region: "Greater Boston",
    desc: "Home to Harvard University and MIT, Cambridge is a vibrant city with tree-lined streets and a mix of Victorian, Colonial, and contemporary architecture.",
    history: "Settled in 1630 and originally named Newetowne, Cambridge was renamed in 1638 after the English university. Home to Harvard Yard — the oldest corporation in the US — and MIT's iconic Dome. Cambridge's Inman Square, Porter Square, and Central Square neighborhoods feature beautiful older homes that Coen Construction loves to restore and expand.",
    landmark: "Harvard University & MIT",
    services: BASE_SERVICES,
    nearbyTowns: ["Somerville", "Brookline", "Watertown", "Arlington", "Medford"],
    faqs: [
      { q: "Does Coen Construction serve all Cambridge neighborhoods?", a: "Yes — we serve Harvard Square, Central Square, Inman Square, Porter Square, East Cambridge, Mid-Cambridge, and all surrounding areas." },
      { q: "Can you help with historic home renovations in Cambridge?", a: "Absolutely. Cambridge has many homes built in the 19th and early 20th centuries. Our team understands how to work with original materials and comply with Cambridge's historic commission guidelines." },
      { q: "What types of home additions are most popular in Cambridge?", a: "Due to Cambridge's smaller lot sizes, second-story additions and rear additions are very popular. We also do a lot of dormer additions and attic conversions for Cambridge homeowners." },
      { q: "What permits are needed in Cambridge?", a: "Cambridge requires building permits from the Inspectional Services Department for structural work. Historic district properties may also need Cambridge Historical Commission approval — we handle all permitting." },
      { q: "What siding is best for Cambridge triple-deckers?", a: "James Hardie fiber cement siding handles New England freeze-thaw cycles beautifully and is approved in most Cambridge historic districts." }
    ],
    img: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=80"
  },
  somerville: {
    name: "Somerville", county: "Middlesex County", state: "MA", zip: "02143",
    region: "Greater Boston",
    desc: "Somerville is a densely populated, creatively energetic city known for its vibrant arts scene, Union Square, and iconic Victorian triple-deckers.",
    history: "Incorporated as a city in 1872, Somerville transformed dramatically in the 21st century, becoming one of the most densely populated cities in New England and a hub for arts and innovation. Its iconic triple-deckers — many over 100 years old — are prime candidates for siding, deck additions, and interior renovations.",
    landmark: "Union Square & Davis Square",
    services: BASE_SERVICES,
    nearbyTowns: ["Cambridge", "Medford", "Malden", "Everett", "Arlington"],
    faqs: [
      { q: "Do you renovate triple-deckers in Somerville?", a: "Yes — we specialize in siding, window replacement, deck additions, and interior renovations for triple-deckers throughout Somerville." },
      { q: "Can you add a deck to a Somerville triple-decker?", a: "Yes. We regularly add rear decks and porches to Somerville's triple-deckers. We handle all the permitting with the City of Somerville." },
      { q: "What permits are needed for home renovations in Somerville?", a: "The City of Somerville requires building permits for structural changes, additions, and major renovations. We handle all permitting as part of our project management." },
      { q: "What siding is best for Somerville triple-deckers?", a: "James Hardie fiber cement and premium vinyl siding are the most popular choices — both handle New England weather well." },
      { q: "Do you serve Davis Square in Somerville?", a: "Yes — we serve all of Somerville including Union Square, Davis Square, Ball Square, Magoun Square, East Somerville, and West Somerville." }
    ],
    img: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80"
  },
  brookline: {
    name: "Brookline", county: "Norfolk County", state: "MA", zip: "02445",
    region: "Greater Boston",
    desc: "Brookline is an affluent town surrounded by Boston, famous for Coolidge Corner, Frederick Law Olmsted parks, and the birthplace of President John F. Kennedy.",
    history: "Incorporated in 1705, Brookline famously resisted annexation by Boston in 1873. The town is home to the Frederick Law Olmsted National Historic Site and the JFK birthplace at 83 Beals Street. Brookline's Victorian mansions and early 20th-century homes are a specialty of our renovation team.",
    landmark: "Coolidge Corner & JFK Birthplace",
    services: BASE_SERVICES,
    nearbyTowns: ["Boston", "Newton", "Needham", "Jamaica Plain"],
    faqs: [
      { q: "Was JFK born in Brookline?", a: "Yes! JFK was born at 83 Beals Street in Brookline in 1917, now a National Historic Site. Many of Brookline's historic homes are what our team specializes in renovating." },
      { q: "Are there historic preservation rules for Brookline homes?", a: "Yes. Brookline has a Preservation Commission that oversees changes in historic districts. We have experience navigating these reviews." },
      { q: "What neighborhoods in Brookline does Coen Construction serve?", a: "We serve Coolidge Corner, Washington Square, Chestnut Hill (Brookline side), Brookline Village, South Brookline, Fisher Hill, and Pill Hill." },
      { q: "What's the typical cost of a kitchen remodel in Brookline?", a: "Kitchen remodels in Brookline typically range from $50,000 for a mid-range refresh to $150,000+ for a full custom renovation." },
      { q: "Do you do deck additions in Brookline?", a: "Yes — we design and build decks, porches, and pergolas throughout Brookline, handling all permitting with the town." }
    ],
    img: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80"
  },
  medford: {
    name: "Medford", county: "Middlesex County", state: "MA", zip: "02155",
    region: "Greater Boston",
    desc: "Medford is a proud suburban city north of Boston with deep colonial roots, the Tufts University community, and beautiful neighborhoods along the Mystic River.",
    history: "Settled in 1630, Medford is one of Massachusetts' oldest communities. Famous for its clipper ship industry and Medford rum, the city is home to Tufts University. The historic West Medford neighborhood features stunning Victorians and colonials perfect for our renovation services.",
    landmark: "Tufts University & Mystic River",
    services: BASE_SERVICES,
    nearbyTowns: ["Somerville", "Cambridge", "Malden", "Woburn", "Arlington"],
    faqs: [
      { q: "What neighborhoods in Medford does Coen Construction serve?", a: "We serve all Medford neighborhoods including West Medford, Medford Square, Lawrence Estates, the Tufts University area, and all surrounding streets." },
      { q: "What home additions are popular in Medford?", a: "Rear additions and second-story expansions are very popular in Medford, where many homes have good footprints but limited square footage. Deck and porch projects are also very popular." },
      { q: "Can you help with historic homes in Medford?", a: "Yes. Medford has many historic Victorians and colonials. We have extensive experience with period-appropriate materials and renovation techniques." },
      { q: "What is Medford famous for?", a: "Medford is home to the Royall House & Slave Quarters, has a deep maritime history from its clipper ship era, and was famous for Medford rum — one of the colonies' finest spirits." },
      { q: "Do you serve the Tufts University area in Medford?", a: "Absolutely. We serve West Medford and the Hillside neighborhood near Tufts, including many older Victorians and colonials." }
    ],
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80"
  },
  revere: {
    name: "Revere", county: "Suffolk County", state: "MA", zip: "02151",
    region: "Greater Boston",
    desc: "Revere is home to Revere Beach — America's first public beach, established in 1896 — and offers a diverse urban community just minutes from downtown Boston.",
    history: "Named after Paul Revere, Revere was incorporated in 1871. Revere Beach, designated in 1896, was the nation's first public beach and remains a beloved destination. The city's proximity to Logan Airport and downtown Boston makes it a prime location for home improvement investment, and many of its 19th-century triple-deckers and Capes are ideal renovation candidates.",
    landmark: "Revere Beach — America's First Public Beach",
    services: BASE_SERVICES,
    nearbyTowns: ["East Boston", "Everett", "Malden", "Saugus", "Winthrop"],
    faqs: [
      { q: "Why is Revere Beach historically significant?", a: "Revere Beach, established in 1896, was the first public beach in the United States. It remains a beloved destination and the site of the annual Revere Beach International Sand Sculpting Festival." },
      { q: "What types of renovations are popular in Revere?", a: "Siding replacements, kitchen remodels, and deck additions are very popular in Revere, particularly on the triple-deckers and Capes near the beachfront neighborhoods." },
      { q: "What siding is best for coastal Revere homes?", a: "James Hardie fiber cement siding is ideal for Revere's coastal climate — it resists salt air, moisture, and freeze-thaw cycles far better than wood or vinyl." },
      { q: "Do you serve all Revere neighborhoods?", a: "Yes — we serve all Revere neighborhoods including Revere Beach, Point of Pines, Beachmont, West Revere, and Prospect Hill." },
      { q: "Can you add a deck near Revere Beach?", a: "Yes. We design and build decks and porches throughout Revere, using materials suited to the coastal environment. We handle all city permitting." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  everett: {
    name: "Everett", county: "Middlesex County", state: "MA", zip: "02149",
    region: "Greater Boston",
    desc: "Everett is a vibrant, rapidly growing city transformed by major developments including Encore Boston Harbor casino and the Assembly Row district just across the border.",
    history: "Incorporated as a city in 1892, Everett has undergone a dramatic revitalization in recent years. The opening of Encore Boston Harbor in 2019 brought major investment to the waterfront. Everett's dense urban neighborhoods feature classic New England triple-deckers, many of which are being renovated and upgraded as the city's real estate market heats up.",
    landmark: "Encore Boston Harbor Casino & Waterfront",
    services: BASE_SERVICES,
    nearbyTowns: ["Somerville", "Malden", "Chelsea", "Medford", "Revere"],
    faqs: [
      { q: "What is Encore Boston Harbor?", a: "Encore Boston Harbor is a luxury casino resort that opened in 2019 on the Mystic River waterfront in Everett. It's helped drive significant real estate investment throughout the city." },
      { q: "What renovations are popular in Everett?", a: "Siding replacements, kitchen remodels, and full triple-decker renovations are very popular as Everett homeowners invest in their properties amid the city's revitalization." },
      { q: "Do you serve all Everett neighborhoods?", a: "Yes — we serve all of Everett including Glendale, West End, East Everett, and the waterfront neighborhoods near Encore Boston Harbor." },
      { q: "What permits are needed for renovations in Everett?", a: "Everett requires building permits from the Inspectional Services Department for structural changes, additions, and major renovations. We handle all permitting." },
      { q: "What's the best siding for Everett triple-deckers?", a: "James Hardie fiber cement or premium vinyl siding are the most popular choices in Everett. Both provide excellent durability and curb appeal at a competitive price point." }
    ],
    img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80"
  },
  allston: {
    name: "Allston", county: "Suffolk County", state: "MA", zip: "02134",
    region: "Greater Boston",
    desc: "Allston is a dynamic Boston neighborhood known for its creative energy, young professional community, and a dense stock of classic New England triple-deckers.",
    history: "Allston has long been one of Boston's most diverse and creative neighborhoods, home to a thriving music scene, independent businesses, and a large student population from nearby Boston University and Harvard's Allston campus. Many of Allston's older triple-deckers and two-family homes are being purchased by young families who want to renovate and put down roots.",
    landmark: "Boston University & Harvard Allston Campus",
    services: ["Home Additions", "Siding", "Kitchen Remodeling", "Custom Carpentry", "Decks & Pergolas"],
    nearbyTowns: ["Brighton", "Brookline", "Cambridge", "Watertown"],
    faqs: [
      { q: "Do you renovate triple-deckers in Allston?", a: "Yes — siding, kitchen remodels, and interior renovations on triple-deckers and two-family homes are among our most common projects in Allston." },
      { q: "Is Harvard expanding into Allston?", a: "Yes! Harvard University is developing a major science and innovation campus in Allston on the north bank of the Charles River. This is driving significant investment and renovation activity in the neighborhood." },
      { q: "What permits are required in Allston?", a: "Allston is part of the City of Boston and requires building permits from Boston's Inspectional Services Department (ISD) for all structural work and renovations." },
      { q: "What siding is recommended for Allston homes?", a: "For Allston's dense urban environment, James Hardie fiber cement siding offers the best durability, low maintenance, and fire resistance — important in a densely built neighborhood." },
      { q: "How do I get a free estimate in Allston?", a: "Call us at (617) 857-COEN or submit our online form. We respond within 1 business day and can schedule a free in-home estimate in Allston typically within 1 week." }
    ],
    img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80"
  },
  brighton: {
    name: "Brighton", county: "Suffolk County", state: "MA", zip: "02135",
    region: "Greater Boston",
    desc: "Brighton is a lively Boston neighborhood bordered by Newton and Brookline, home to Boston College and a mix of Victorian triple-deckers and single-family homes.",
    history: "Brighton was annexed by Boston in 1874 and was historically known for its stockyards and meatpacking industry. Today, it's a vibrant residential neighborhood with a strong Boston College community and beautiful tree-lined streets. Brighton's Victorian and early 20th-century housing stock is well-suited to the siding, addition, and carpentry work we specialize in.",
    landmark: "Boston College & Cleveland Circle",
    services: BASE_SERVICES,
    nearbyTowns: ["Allston", "Newton", "Brookline", "Watertown"],
    faqs: [
      { q: "What neighborhoods in Brighton does Coen Construction serve?", a: "We serve all of Brighton including Cleveland Circle, Oak Square, Chestnut Hill (Boston side), St. Elizabeth's area, and all surrounding streets." },
      { q: "Are there historic preservation rules in Brighton?", a: "Brighton is part of Boston and some areas fall within historic districts. We're familiar with Boston's historic commission requirements and can guide you through any needed approvals." },
      { q: "What renovations are most popular in Brighton?", a: "Kitchen remodels, siding replacements, and home additions on Brighton's two-family and triple-decker homes are very popular, especially as the neighborhood attracts more young families." },
      { q: "Can I add a deck to my Brighton home?", a: "Yes. We design and build decks and porches throughout Brighton, handling all permits with the City of Boston's ISD." },
      { q: "Is Boston College near your Brighton service area?", a: "Yes — we regularly serve the entire Brighton neighborhood including areas adjacent to Boston College's main and Brighton campuses." }
    ],
    img: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1200&q=80"
  },
  charlestown: {
    name: "Charlestown", county: "Suffolk County", state: "MA", zip: "02129",
    region: "Greater Boston",
    desc: "Charlestown is one of Boston's most historic neighborhoods, home to the Bunker Hill Monument, the USS Constitution, and stunning Federal and Greek Revival rowhouses.",
    history: "The oldest neighborhood in Boston (settled 1629), Charlestown was the site of the Battle of Bunker Hill on June 17, 1775. The Bunker Hill Monument and the USS Constitution (Old Ironsides) are national landmarks. Charlestown's beautiful brick rowhouses and Federal-style architecture make it one of the most sought-after renovation markets in Greater Boston.",
    landmark: "Bunker Hill Monument & USS Constitution",
    services: ["Home Additions", "Custom Carpentry", "Kitchen Remodeling", "Siding", "Decks & Pergolas"],
    nearbyTowns: ["East Boston", "Cambridge", "Somerville", "North End"],
    faqs: [
      { q: "Are there historic preservation rules for Charlestown homes?", a: "Yes. Charlestown has significant historic district protections, particularly around Monument Square. We have extensive experience working within Boston's historic preservation requirements." },
      { q: "What renovations are popular in Charlestown?", a: "Custom carpentry, kitchen remodels, and historic window/door restoration are very popular in Charlestown's rowhouses and townhouses. Many owners also add roof decks." },
      { q: "Can you add a roof deck in Charlestown?", a: "Roof deck additions are popular in Charlestown due to the incredible views of Boston Harbor and the Bunker Hill Monument. We handle the structural engineering and all Boston ISD permitting." },
      { q: "What makes Charlestown homes unique?", a: "Charlestown has one of the highest concentrations of pre-Civil War Federal and Greek Revival brick rowhouses in New England. These homes require specialized knowledge to renovate properly while preserving their historic character." },
      { q: "How do I get a free estimate in Charlestown?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day and can typically schedule a free in-home estimate within 1 week." }
    ],
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80"
  },
  "east-boston": {
    name: "East Boston", county: "Suffolk County", state: "MA", zip: "02128",
    region: "Greater Boston",
    desc: "East Boston — Eastie — is a waterfront neighborhood with stunning views of Boston Harbor, a vibrant Latino culture, and a rapidly appreciating real estate market.",
    history: "East Boston is connected to the rest of Boston by the Sumner and Callahan Tunnels and the Blue Line. Historically an immigration gateway, today Eastie is one of Boston's hottest real estate markets. Its early 20th-century triple-deckers and colonials offer excellent renovation opportunities, and the waterfront development is driving major investment throughout the neighborhood.",
    landmark: "Boston Harbor Views & Piers Park",
    services: BASE_SERVICES,
    nearbyTowns: ["Revere", "Winthrop", "Charlestown", "South Boston"],
    faqs: [
      { q: "Why is East Boston a hot real estate market?", a: "East Boston offers stunning Boston Harbor views, Blue Line access to downtown, and relatively affordable home prices compared to other Boston neighborhoods — making it one of the fastest-appreciating areas in Greater Boston." },
      { q: "What siding is best for East Boston's coastal location?", a: "James Hardie fiber cement siding is our top recommendation for East Boston. It resists salt air, moisture, and freeze-thaw cycles — critical for a waterfront neighborhood." },
      { q: "Do you serve all East Boston neighborhoods?", a: "Yes — we serve all of East Boston including Eagle Hill, Jeffries Point, Maverick Square, Orient Heights, and the waterfront areas near Piers Park." },
      { q: "Can you add a deck with harbor views in East Boston?", a: "Yes — rooftop decks and rear decks in East Boston can offer stunning harbor views. We design and build these projects and handle all Boston ISD permitting." },
      { q: "What permits are needed for East Boston renovations?", a: "East Boston is part of the City of Boston. All structural work requires permits from Boston's Inspectional Services Department (ISD). We handle all permitting on your behalf." }
    ],
    img: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80"
  },
  dorchester: {
    name: "Dorchester", county: "Suffolk County", state: "MA", zip: "02121",
    region: "Greater Boston",
    desc: "Dorchester is Boston's largest neighborhood — a diverse, vibrant community with beautiful Victorian homes, the Neponset River Greenway, and a rich cultural heritage.",
    history: "Settled in 1630 and annexed by Boston in 1870, Dorchester is the largest neighborhood in Boston by both area and population. It's home to the John F. Kennedy Presidential Library & Museum on Columbia Point. Dorchester's vast stock of Victorian triple-deckers, Capes, and Colonials make it one of our most active renovation markets in Greater Boston.",
    landmark: "JFK Presidential Library & Columbia Point",
    services: BASE_SERVICES,
    nearbyTowns: ["South Boston", "Roxbury", "Milton", "Quincy", "Jamaica Plain"],
    faqs: [
      { q: "What is the JFK Presidential Library?", a: "The John F. Kennedy Presidential Library & Museum is located on Columbia Point in Dorchester. Designed by I.M. Pei, it overlooks Boston Harbor and is one of Boston's most visited cultural institutions." },
      { q: "What neighborhoods in Dorchester does Coen Construction serve?", a: "We serve all of Dorchester including Savin Hill, Fields Corner, Uphams Corner, Four Corners, Lower Mills, Neponset, Cedar Grove, and Columbia Point." },
      { q: "What renovations are popular in Dorchester?", a: "Triple-decker siding replacements, kitchen remodels, and home additions are very popular in Dorchester. We also do a lot of deck and porch projects." },
      { q: "Can you renovate a Victorian triple-decker in Dorchester?", a: "Absolutely — this is one of our specialties. From full exterior re-siding to interior gut renovations, we've completed many triple-decker projects throughout Dorchester." },
      { q: "What is the Neponset River Greenway?", a: "The Neponset River Greenway is a beautiful multi-use trail along the Neponset River in Dorchester and Milton. Many of our clients live in the Lower Mills and Cedar Grove neighborhoods along the greenway." }
    ],
    img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80"
  },
  "south-boston": {
    name: "South Boston", county: "Suffolk County", state: "MA", zip: "02127",
    region: "Greater Boston",
    desc: "South Boston — Southie — is one of Boston's most dynamic neighborhoods, featuring Carson Beach, the Innovation District waterfront, and a rapidly evolving real estate market.",
    history: "South Boston has transformed dramatically over the past two decades from a working-class Irish-American neighborhood into one of Greater Boston's most desirable addresses. The Seaport District (Fort Point) has become a major innovation hub. Southie's Victorian triple-deckers, rowhouses, and new luxury condos represent a broad range of renovation opportunities.",
    landmark: "Carson Beach & Seaport District",
    services: ["Home Additions", "Custom Carpentry", "Kitchen Remodeling", "Decks & Pergolas", "Siding"],
    nearbyTowns: ["Dorchester", "East Boston", "Roxbury", "Charlestown"],
    faqs: [
      { q: "What areas of South Boston does Coen Construction serve?", a: "We serve all of South Boston including the Lower End, City Point, East Side, the Seaport / Fort Point area, and all surrounding streets." },
      { q: "Can you add a roof deck in South Boston?", a: "Yes — roof deck additions are extremely popular in South Boston for the incredible harbor and city views. We handle structural work and all Boston ISD permitting." },
      { q: "What renovations are most popular in South Boston?", a: "Custom carpentry, full kitchen remodels, and roof deck additions are the most popular projects in South Boston, particularly on the neighborhood's townhouses and condos." },
      { q: "Are there historic preservation rules in South Boston?", a: "Some areas of South Boston fall within Boston Landmark Commission districts. We are well-versed in navigating Boston's historic preservation requirements." },
      { q: "What is the Seaport District?", a: "The Seaport District (formerly Fort Point Channel) is South Boston's innovation and cultural hub, home to major tech companies, the Institute of Contemporary Art, and Boston's fastest-growing restaurant scene." }
    ],
    img: "https://images.unsplash.com/photo-1568010434929-06e7c8d8bcfe?w=1200&q=80"
  },
  "jamaica-plain": {
    name: "Jamaica Plain", county: "Suffolk County", state: "MA", zip: "02130",
    region: "Greater Boston",
    desc: "Jamaica Plain — JP — is a leafy, progressive Boston neighborhood centered around Jamaica Pond and the Arnold Arboretum, with beautiful Victorian homes and a vibrant community.",
    history: "Jamaica Plain was a prestigious suburban retreat for Boston's elite in the 19th century, accessible by streetcar. The Arnold Arboretum (1872), one of the world's finest collections of trees and shrubs, anchors the neighborhood. JP's Victorian homes, Queen Annes, and colonials — many sitting on generous lots — are ideal candidates for the additions and renovations Coen Construction specializes in.",
    landmark: "Jamaica Pond & Arnold Arboretum",
    services: BASE_SERVICES,
    nearbyTowns: ["Roslindale", "West Roxbury", "Brookline", "Roxbury", "Dorchester"],
    faqs: [
      { q: "What is the Arnold Arboretum?", a: "The Arnold Arboretum, established in 1872, is one of the world's finest plant collections, spanning 281 acres in Jamaica Plain. It's part of the Emerald Necklace park system designed by Frederick Law Olmsted." },
      { q: "What types of homes does Coen Construction work on in Jamaica Plain?", a: "JP has beautiful Victorian, Queen Anne, and Colonial Revival homes — many sitting on generous lots. We also work on two-families and triple-deckers throughout the neighborhood." },
      { q: "What renovations are popular in Jamaica Plain?", a: "Home additions, kitchen remodels, custom carpentry, and deck additions are very popular in Jamaica Plain, especially on the larger Victorians near Jamaica Pond." },
      { q: "Can you add onto a Victorian home in Jamaica Plain?", a: "This is our specialty. We design additions that complement original Victorian architecture — proper rooflines, matching trim, and material selection that makes the addition look original." },
      { q: "Does Coen Construction serve all of Jamaica Plain?", a: "Yes — we serve all of JP including Centre Street, Jamaica Pond, Green Street, Arboretum, Pondside, and Stonybrook areas." }
    ],
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"
  },
  roslindale: {
    name: "Roslindale", county: "Suffolk County", state: "MA", zip: "02131",
    region: "Greater Boston",
    desc: "Roslindale is a family-friendly Boston neighborhood with a thriving village center, excellent access to the Arnold Arboretum, and beautiful early 20th-century homes.",
    history: "Roslindale has long been one of Boston's most livable neighborhoods — accessible via the Orange Line and commuter rail, with excellent parks and a charming village center. 'Rozzie's' housing stock of Colonials, Capes, and bungalows from the 1920s–1950s is ideal for the additions, remodels, and carpentry work we specialize in.",
    landmark: "Roslindale Village & Forest Hills Cemetery",
    services: BASE_SERVICES,
    nearbyTowns: ["Jamaica Plain", "West Roxbury", "Hyde Park", "Dedham"],
    faqs: [
      { q: "What areas of Roslindale does Coen Construction serve?", a: "We serve all of Roslindale including Roslindale Village, Bellevue Hill, Heathfield, and all surrounding streets." },
      { q: "What renovations are popular in Roslindale?", a: "Home additions (particularly rear and second-story), kitchen remodels, siding replacements, and custom carpentry are very popular in Roslindale's Capes and Colonials." },
      { q: "What is Forest Hills Cemetery?", a: "Forest Hills Cemetery, established in 1848, is a National Historic Landmark garden cemetery in Roslindale. It's a beautiful Victorian-era landscape and one of Boston's finest outdoor spaces." },
      { q: "Can you raise a Cape Cod house in Roslindale?", a: "Yes — Cape-to-Colonial conversions adding a full second story are very popular in Roslindale and one of the best value-adds in the Boston real estate market." },
      { q: "How do I get a free estimate in Roslindale?", a: "Call (617) 857-COEN or use our online contact form. We respond within 1 business day and can typically schedule a free in-home estimate within 1 week." }
    ],
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
  },
  "hyde-park": {
    name: "Hyde Park", county: "Suffolk County", state: "MA", zip: "02136",
    region: "Greater Boston",
    desc: "Hyde Park is Boston's southernmost neighborhood — a quiet, suburban-feeling community with the Stony Brook Reservation and beautiful single-family homes ideal for renovation.",
    history: "Hyde Park was an independent town until its annexation by Boston in 1912 — the last town to be annexed. It retains a distinctly suburban character unique within Boston, with larger lots, single-family homes, and tree-lined streets. The Stony Brook Reservation provides over 475 acres of green space. Hyde Park's Capes, Colonials, and Victorians are excellent renovation candidates.",
    landmark: "Stony Brook Reservation & Readville",
    services: BASE_SERVICES,
    nearbyTowns: ["Roslindale", "West Roxbury", "Canton", "Dedham", "Norwood"],
    faqs: [
      { q: "What makes Hyde Park unique within Boston?", a: "Hyde Park was the last town annexed by Boston (1912) and retains the most suburban character of any Boston neighborhood — with larger lots, single-family homes, and excellent access to the Stony Brook Reservation." },
      { q: "What renovations are popular in Hyde Park?", a: "Home additions, deck construction, kitchen remodels, and siding replacements are very popular in Hyde Park. The larger lot sizes make outdoor living additions especially appealing." },
      { q: "What neighborhoods in Hyde Park does Coen Construction serve?", a: "We serve all of Hyde Park including Readville, Fairmount, Cleary Square, and all surrounding residential areas." },
      { q: "Can you build a large deck in Hyde Park?", a: "Yes — Hyde Park's larger lot sizes often allow for substantial deck and outdoor living projects. We design and build custom decks, porches, and pergolas throughout Hyde Park." },
      { q: "Is Hyde Park accessible from South Shore towns?", a: "Yes — Hyde Park borders Canton and Dedham, making it easily accessible from many South Shore communities and convenient for our crews coming from our Stoughton headquarters." }
    ],
    img: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1200&q=80"
  },
  "west-roxbury": {
    name: "West Roxbury", county: "Suffolk County", state: "MA", zip: "02132",
    region: "Greater Boston",
    desc: "West Roxbury is Boston's most suburban neighborhood — a quiet, family-oriented community with excellent schools, Centre Street's village atmosphere, and beautiful single-family homes.",
    history: "West Roxbury, like Hyde Park, retains a deeply suburban feel despite being part of Boston. Its Capes, Colonials, and ranches from the mid-20th century are some of the most sought-after renovation properties in Boston. The neighbourhood borders Brookline and Dedham and is served by the Needham Line commuter rail.",
    landmark: "Centre Street Village & Millennium Park",
    services: BASE_SERVICES,
    nearbyTowns: ["Jamaica Plain", "Roslindale", "Hyde Park", "Dedham", "Brookline"],
    faqs: [
      { q: "What makes West Roxbury different from other Boston neighborhoods?", a: "West Roxbury has the most suburban character of any Boston neighborhood, with tree-lined streets, single-family homes on real lots, excellent schools, and a charming village atmosphere along Centre Street." },
      { q: "What renovations are most popular in West Roxbury?", a: "Kitchen remodels, home additions (rear bump-outs and second-story on Capes), and deck/porch installations are extremely popular in West Roxbury." },
      { q: "Can you convert a Cape Cod to a Colonial in West Roxbury?", a: "Yes — this is one of our most popular projects in West Roxbury. We raise the roofline and add a full second floor, typically adding 800–1,200 sq ft of living space." },
      { q: "Does Coen Construction serve all of West Roxbury?", a: "Yes — we serve all of West Roxbury including Bellevue Hill, the Centre Street corridor, Spring Street, and all surrounding neighborhoods." },
      { q: "What is Millennium Park in West Roxbury?", a: "Millennium Park is a 100-acre park in West Roxbury built on the former Landfill site, offering beautiful views, walking trails, and athletic fields. Many of our clients live in the surrounding neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80"
  },
  roxbury: {
    name: "Roxbury", county: "Suffolk County", state: "MA", zip: "02119",
    region: "Greater Boston",
    desc: "Roxbury is a historic Boston neighborhood with a rich cultural heritage, beautiful Victorian homes, and proximity to Mission Hill, the South End, and Jamaica Plain.",
    history: "Roxbury is one of Boston's oldest neighborhoods, incorporated in 1630 and annexed by Boston in 1868. It was a prosperous Victorian suburb in the late 19th century, and many of its mansions and row houses from that era remain standing. Roxbury has a strong African American cultural heritage and is home to Dudley Square (now Nubian Square) — the heart of the neighborhood.",
    landmark: "Nubian Square (Dudley Square) & Highland Park",
    services: BASE_SERVICES,
    nearbyTowns: ["Jamaica Plain", "Dorchester", "South Boston", "South End"],
    faqs: [
      { q: "What neighborhoods in Roxbury does Coen Construction serve?", a: "We serve all of Roxbury including Nubian Square, Highland Park, Egleston Square, Grove Hall, and all surrounding residential streets." },
      { q: "What types of homes are found in Roxbury?", a: "Roxbury has a beautiful mix of Victorian mansions, Queen Anne rowhouses, triple-deckers, and early 20th-century colonials — many with significant renovation potential." },
      { q: "What renovations are popular in Roxbury?", a: "Siding replacements, kitchen remodels, and home additions are popular in Roxbury, particularly as homeowners invest in the neighborhood's beautiful Victorian housing stock." },
      { q: "What is Nubian Square in Roxbury?", a: "Nubian Square (formerly Dudley Square) is the cultural and commercial heart of Roxbury, named to honor the neighborhood's African heritage. It's a major transit hub and community center for the area." },
      { q: "How do I get a free estimate in Roxbury?", a: "Call (617) 857-COEN or submit our online form. We respond within 1 business day and can schedule a free in-home estimate in Roxbury." }
    ],
    img: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80"
  },

  // ─── METRO WEST ───────────────────────────────────────────────────
  lexington: {
    name: "Lexington", county: "Middlesex County", state: "MA", zip: "02420",
    region: "Metro West",
    desc: "Lexington is where the American Revolution began — the site of the 'shot heard round the world' on April 19, 1775. Today it's an affluent town with exceptional schools and beautiful historic homes.",
    history: "On April 19, 1775, the first shots of the American Revolution were fired on Lexington Green. The Minuteman statue on the Battle Green is one of America's most recognizable monuments. Lexington's Colonial and Federal-style homes — many dating to the 18th and 19th centuries — are what Coen Construction's craftsmanship is designed to preserve and enhance.",
    landmark: "Lexington Battle Green & Minuteman Statue",
    services: BASE_SERVICES,
    nearbyTowns: ["Arlington", "Bedford", "Burlington", "Waltham", "Concord"],
    faqs: [
      { q: "Why is Lexington famous historically?", a: "Lexington is famous as the site of the first battle of the American Revolution on April 19, 1775. The Minuteman statue and Buckman Tavern are iconic landmarks." },
      { q: "Can you add onto a Colonial-era home in Lexington?", a: "This is our specialty. We design additions that complement original New England Colonial architecture — proper rooflines, authentic window placement, matching trim profiles." },
      { q: "What types of homes does Coen Construction work on in Lexington?", a: "Lexington has a mix of historic Colonial and Federal-style homes, as well as 1950s–1970s ranches and Capes great for additions. We have extensive experience with both." },
      { q: "What permits are needed for home additions in Lexington?", a: "Lexington requires permits from the Building Department. Properties in historic districts may also need Historical Commission approval. We handle all permitting." },
      { q: "What is the Minuteman Bikeway?", a: "The Minuteman Commuter Bikeway is a 10-mile rail trail running from Cambridge to Bedford through Lexington. Many homes along its route are in our regular service area." }
    ],
    img: "https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?w=1200&q=80"
  },
  weston: {
    name: "Weston", county: "Middlesex County", state: "MA", zip: "02493",
    region: "Metro West",
    desc: "Weston is consistently ranked among the wealthiest and most desirable towns in Massachusetts, known for its extensive conservation land, top-rated schools, and stunning estate-style homes.",
    history: "Incorporated in 1713, Weston has maintained its rural character while becoming one of Massachusetts' most prestigious addresses. Over 40% of the town's land is protected conservation land, creating a park-like environment. Weston's estates and luxury single-family homes demand the highest level of craftsmanship — exactly what Coen Construction delivers.",
    landmark: "Weston Town Center & Case Estates (Arnold Arboretum)",
    services: BASE_SERVICES,
    nearbyTowns: ["Wayland", "Lincoln", "Wellesley", "Newton", "Waltham"],
    faqs: [
      { q: "What makes Weston homes unique?", a: "Weston has some of the largest private lots and most prestigious estate-style homes in Greater Boston. Many are custom-built Colonials, Georgians, and Contemporaries on 1–5+ acre lots." },
      { q: "What renovations are popular in Weston?", a: "Luxury kitchen remodels, high-end custom carpentry, major home additions, and premium outdoor living spaces (pergolas, full outdoor kitchens) are very popular in Weston." },
      { q: "Do you work on estate-style homes in Weston?", a: "Yes — Coen Construction has extensive experience with large-scale, high-end renovation projects on Weston's estate properties. We're comfortable with projects of any scale." },
      { q: "What building restrictions apply in Weston?", a: "Weston has significant wetlands setback requirements and conservation restrictions on many properties. We work with local engineers to navigate these regulations." },
      { q: "Does Coen Construction serve all of Weston?", a: "Yes — we serve all of Weston including South Weston, North Weston, the Town Center area, and all surrounding residential neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1200&q=80"
  },
  waltham: {
    name: "Waltham", county: "Middlesex County", state: "MA", zip: "02451",
    region: "Metro West",
    desc: "Waltham is a dynamic city west of Boston with a rich industrial history, the renowned Brandeis University, and a diverse mix of Victorian to mid-century homes.",
    history: "Waltham was a pioneering industrial city — the Boston Manufacturing Company established the first fully integrated textile mill in America here in 1814, launching the American Industrial Revolution. Waltham's Victorian and early 20th-century homes are perfect renovation candidates.",
    landmark: "Brandeis University & Watch City Mill District",
    services: BASE_SERVICES,
    nearbyTowns: ["Newton", "Belmont", "Watertown", "Lexington", "Needham"],
    faqs: [
      { q: "What is Waltham known for historically?", a: "Waltham was the birthplace of the American Industrial Revolution — the Boston Manufacturing Company opened the first fully integrated textile mill here in 1814. The city was also famous for the Waltham Watch Company." },
      { q: "What home improvements are most popular in Waltham?", a: "Kitchen remodels, siding replacements, and home additions are very popular in Waltham, where many Victorian and 1920s-era homes are being updated by new owners." },
      { q: "Does Coen Construction serve Brandeis University neighborhood in Waltham?", a: "Yes — we serve all of Waltham including neighborhoods near Brandeis, South Side, North Waltham, Lakeview, and the historic mill district." },
      { q: "What's the best deck material for Waltham's climate?", a: "Composite decking (Trex or TimberTech) is the most popular choice in Waltham. It resists freeze-thaw cycles and never needs staining." },
      { q: "Do you handle additions on Victorian homes in Waltham?", a: "Yes — we specialize in additions that complement Victorian architecture, matching original trim profiles, rooflines, and window styles." }
    ],
    img: "https://images.unsplash.com/photo-1560184897-502a475f7a0d?w=1200&q=80"
  },
  concord: {
    name: "Concord", county: "Middlesex County", state: "MA", zip: "01742",
    region: "Metro West",
    desc: "Concord is one of America's most historically rich towns — birthplace of the American Revolution's second battle and home of Walden Pond, Louisa May Alcott, and Ralph Waldo Emerson.",
    history: "On April 19, 1775 — the same day as Lexington — the second battle of the American Revolution was fought at North Bridge in Concord. Henry David Thoreau lived at Walden Pond here. Louisa May Alcott wrote Little Women at Orchard House. Today, Concord is an affluent, historically conscious community where every renovation must respect the town's architectural heritage.",
    landmark: "Walden Pond & North Bridge (Minuteman National Historical Park)",
    services: BASE_SERVICES,
    nearbyTowns: ["Lexington", "Lincoln", "Sudbury", "Bedford", "Maynard"],
    faqs: [
      { q: "Why is Concord historically famous?", a: "Concord was the site of the second battle of the American Revolution at North Bridge on April 19, 1775. It's also where Thoreau lived at Walden Pond and where Emerson, Hawthorne, and Louisa May Alcott all lived and wrote." },
      { q: "Are there historic preservation restrictions in Concord?", a: "Yes. Concord has a strong Historic Districts Commission and many homes fall within protected historic districts. We have extensive experience navigating these requirements while delivering beautiful renovation results." },
      { q: "What renovations are popular in Concord?", a: "High-quality home additions, premium custom carpentry, and luxury kitchen remodels are very popular in Concord. Homeowners value craftsmanship that matches the town's historic character." },
      { q: "Can you add onto a historic Colonial or Federal home in Concord?", a: "Yes — this is a specialty of ours. We design additions that are virtually indistinguishable from original Colonial and Federal architecture, using appropriate materials and detailing." },
      { q: "What is Walden Pond?", a: "Walden Pond is where Henry David Thoreau lived from 1845 to 1847 and wrote his famous work 'Walden.' Today it's a state reservation and one of the most visited historic sites in New England." }
    ],
    img: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80"
  },
  lincoln: {
    name: "Lincoln", county: "Middlesex County", state: "MA", zip: "01773",
    region: "Metro West",
    desc: "Lincoln is a small, affluent town renowned for its vast conservation land, the DeCordova Sculpture Park & Museum, and beautiful rural character within easy commuting distance of Boston.",
    history: "Incorporated in 1754, Lincoln has preserved its rural character more successfully than almost any other Greater Boston suburb. Over 60% of the town is conservation land. The DeCordova Sculpture Park & Museum, set on 35 acres, is one of New England's finest contemporary art destinations. Lincoln's custom-built homes on generous lots demand premium renovation craftsmanship.",
    landmark: "DeCordova Sculpture Park & Museum",
    services: BASE_SERVICES,
    nearbyTowns: ["Concord", "Weston", "Lexington", "Waltham", "Wayland"],
    faqs: [
      { q: "What is the DeCordova Sculpture Park?", a: "The DeCordova Sculpture Park & Museum is a world-class contemporary art museum set on 35 acres overlooking Sandy Pond in Lincoln. It's one of the largest sculpture parks in New England." },
      { q: "What makes Lincoln homes unique?", a: "Lincoln homes are typically custom-built on large, conservation-adjacent lots. The town's strict zoning preserves its rural character, and homes here command premium craftsmanship." },
      { q: "What renovations are popular in Lincoln?", a: "Large-scale home additions, luxury outdoor living spaces, and high-end custom carpentry are popular in Lincoln. Homeowners here invest significantly in their properties." },
      { q: "Are there building restrictions in Lincoln?", a: "Lincoln has significant conservation land setback requirements and strict zoning. We work with local engineers and the town's Building Department to ensure full compliance." },
      { q: "How do I get a free estimate in Lincoln?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day and schedule free in-home estimates throughout Lincoln." }
    ],
    img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"
  },
  wellesley: {
    name: "Wellesley", county: "Norfolk County", state: "MA", zip: "02482",
    region: "Metro West",
    desc: "Wellesley is one of Greater Boston's most prestigious communities, home to Wellesley College and the renowned Wellesley Hills shopping district, with stunning Colonial and Tudor estates.",
    history: "Wellesley was incorporated in 1881 and has maintained its reputation as one of New England's most desirable addresses. Home to Wellesley College — one of the prestigious Seven Sisters — the town features beautiful tree-lined streets, the Charles River, and a range of stunning historic homes. The famous 'Scream Tunnel' along the Boston Marathon route runs through Wellesley College.",
    landmark: "Wellesley College & Scream Tunnel (Boston Marathon)",
    services: BASE_SERVICES,
    nearbyTowns: ["Newton", "Needham", "Natick", "Dover", "Weston"],
    faqs: [
      { q: "Why is Wellesley famous along the Boston Marathon route?", a: "The 'Scream Tunnel' is a beloved Boston Marathon tradition where Wellesley College students line the course near mile 13 and cheer deafeningly for runners. It's one of the most famous moments on the 26.2-mile course." },
      { q: "What types of homes does Coen Construction work on in Wellesley?", a: "Wellesley has beautiful Colonial Revivals, Tudors, Craftsman bungalows, and mid-century homes on generous lots. We work on all styles and eras of Wellesley homes." },
      { q: "What renovations are most popular in Wellesley?", a: "Luxury kitchen remodels, large home additions, premium custom carpentry (built-ins, coffered ceilings, wainscoting), and high-end outdoor living spaces are most popular in Wellesley." },
      { q: "Are there historic preservation requirements in Wellesley?", a: "Wellesley has an active Historical Commission and many homes are in or adjacent to historic districts. We have extensive experience working within these requirements." },
      { q: "Does Coen Construction serve all of Wellesley?", a: "Yes — we serve all of Wellesley including Wellesley Hills, Wellesley Farms, Wellesley Square, and all surrounding residential neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=1200&q=80"
  },
  newton: {
    name: "Newton", county: "Middlesex County", state: "MA", zip: "02458",
    region: "Metro West",
    desc: "Newton — the 'Garden City' — is one of Greater Boston's most prestigious communities, spanning 13 distinct villages and featuring stunning Victorian and Colonial Revival homes.",
    history: "Originally settled in 1630, Newton is known as the 'Garden City' for its extensive parks and tree-lined boulevards. Famous for the Boston Marathon's Newton Hills (Heartbreak Hill), Newton's Victorian and Colonial Revival homes make it a prime market for premium home additions and renovations.",
    landmark: "Heartbreak Hill (Boston Marathon) & Newton Villages",
    services: BASE_SERVICES,
    nearbyTowns: ["Brookline", "Waltham", "Needham", "Wellesley", "Watertown"],
    faqs: [
      { q: "What is Heartbreak Hill?", a: "Heartbreak Hill is a series of hills in Newton along the Boston Marathon route near miles 17–21. Many of the beautiful Victorian and Colonial homes lining the marathon route in Newton are exactly what our team specializes in renovating." },
      { q: "Do you work in all 13 Newton villages?", a: "Yes — we serve Newton Centre, Newton Corner, Newton Highlands, Newton Lower Falls, Newton Upper Falls, Newtonville, Nonantum, Oak Hill, Thompsonville, Waban, Chestnut Hill (Newton side), and West Newton." },
      { q: "What are the best home improvements to increase value in Newton?", a: "Kitchen remodels, bathroom additions, and high-quality home additions deliver the highest ROI in Newton's premium real estate market. Custom carpentry upgrades are also very popular." },
      { q: "Can you build on smaller Newton lots?", a: "Yes. Newton has many constraints on lot coverage and setbacks. We work with local engineers and architects to maximize your allowable buildable area within zoning limits." },
      { q: "Why is Newton called the 'Garden City'?", a: "Newton earned the 'Garden City' nickname in the late 19th century for its extensive parks, tree-lined boulevards, and residential greenery — a planned streetcar suburb at its finest." }
    ],
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
  },
  medfield: {
    name: "Medfield", county: "Norfolk County", state: "MA", zip: "02052",
    region: "Metro West",
    desc: "Medfield is a beautiful, family-oriented suburb along the Charles River, known for its excellent schools, Noon Hill conservation area, and charming New England town character.",
    history: "Incorporated in 1651, Medfield has one of the most dramatic histories of any Massachusetts town — it was completely destroyed by Wampanoag warriors during King Philip's War in 1676 and then rebuilt. Today, Medfield is a peaceful, prosperous community with excellent schools and beautiful Colonials, Capes, and Tudors along the Charles River.",
    landmark: "Noon Hill Reservation & Charles River",
    services: BASE_SERVICES,
    nearbyTowns: ["Millis", "Medway", "Sherborn", "Dover", "Norwood"],
    faqs: [
      { q: "What is Noon Hill Reservation in Medfield?", a: "Noon Hill Reservation is a beautiful 200-acre conservation area in Medfield offering hiking and wildlife viewing along the Charles River. Many of our clients live in the surrounding residential neighborhoods." },
      { q: "What renovations are popular in Medfield?", a: "Home additions, deck and pergola construction, kitchen remodels, and custom carpentry are very popular in Medfield's Capes, Colonials, and Tudors." },
      { q: "Does Coen Construction serve all of Medfield?", a: "Yes — we serve all of Medfield including the Town Center, South Street corridor, Charles River frontage, and all surrounding neighborhoods." },
      { q: "What permits are required for renovations in Medfield?", a: "Medfield requires building permits from the Building Department for structural work, additions, and major renovations. We handle all permitting as part of our service." },
      { q: "Can you build a deck on a Charles River property in Medfield?", a: "Yes — we design and build decks and outdoor living spaces throughout Medfield, including properties near the Charles River. Wetlands setback requirements apply and we navigate these carefully." }
    ],
    img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80"
  },
  millis: {
    name: "Millis", county: "Norfolk County", state: "MA", zip: "02054",
    region: "Metro West",
    desc: "Millis is a quiet, rural suburb southwest of Boston along the Charles River, offering a peaceful small-town atmosphere with excellent access to Metro West communities.",
    history: "Millis was incorporated in 1885 from parts of Medfield and Medway. The town has maintained its small-town character with a compact village center and a mix of historic and mid-century homes along the Charles River corridor. Millis homeowners are discovering the value in investing in their properties as surrounding communities become increasingly expensive.",
    landmark: "Charles River & Bogastow Brook Conservation Area",
    services: BASE_SERVICES,
    nearbyTowns: ["Medfield", "Medway", "Holliston", "Norfolk", "Walpole"],
    faqs: [
      { q: "Does Coen Construction serve Millis, MA?", a: "Yes — Coen Construction proudly serves Millis and all surrounding Metro West and South Shore communities. Contact us for a free estimate." },
      { q: "What services do you offer in Millis?", a: "In Millis, we offer home additions, deck and pergola construction, siding installation, kitchen remodeling, custom carpentry, and snow removal." },
      { q: "What renovations are popular in Millis?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Millis, where many homeowners are investing in their properties." },
      { q: "What permits are needed for home renovations in Millis?", a: "Millis requires building permits from the Town's Building Department for structural changes and major renovations. We handle all permitting as part of our service." },
      { q: "How do I get a free estimate in Millis?", a: "Call (617) 857-COEN or fill out our online form. We respond within 1 business day and can schedule a free in-home estimate in Millis." }
    ],
    img: "https://images.unsplash.com/photo-1560184897-502a475f7a0d?w=1200&q=80"
  },
  dedham: {
    name: "Dedham", county: "Norfolk County", state: "MA", zip: "02026",
    region: "Metro West",
    desc: "Dedham is a historic suburban town southwest of Boston, home to the famous Dedham Pottery craft tradition and beautiful neighborhoods along the Charles River.",
    history: "One of the oldest towns in Massachusetts (incorporated 1636), Dedham served as the county seat of Norfolk County. Dedham is famous for the Arts & Crafts pottery produced by the Dedham Pottery from 1896 to 1943. Today, Dedham's mix of Colonials, Victorians, and mid-century homes offer excellent renovation opportunities.",
    landmark: "Dedham Square & Legacy Place",
    services: BASE_SERVICES,
    nearbyTowns: ["Westwood", "Norwood", "Canton", "Brookline", "Jamaica Plain"],
    faqs: [
      { q: "What is Dedham Pottery?", a: "Dedham Pottery (1896–1943) was famous for its distinctive crackle glaze and Arts & Crafts designs. The craftsman tradition it represents still influences many Dedham homeowners who seek the same handcrafted care in their home renovations." },
      { q: "What renovations are popular in Dedham?", a: "Kitchen remodels, home additions, siding replacements, and custom carpentry are very popular in Dedham's Colonials, Victorians, and mid-century homes." },
      { q: "Does Coen Construction serve all of Dedham?", a: "Yes — we serve all of Dedham including Dedham Square, Oakdale, Readville (the Dedham side), and East Dedham." },
      { q: "What permits are required in Dedham?", a: "Dedham requires building permits from the Building Department for structural work. We handle all permitting as part of our project management service." },
      { q: "Can you build a deck in Dedham near the Charles River?", a: "Yes — we design and build decks throughout Dedham. Properties near the Charles River may have wetlands setback requirements, which we navigate carefully." }
    ],
    img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"
  },
  westwood: {
    name: "Westwood", county: "Norfolk County", state: "MA", zip: "02090",
    region: "Metro West",
    desc: "Westwood is an affluent, family-friendly suburb south of Boston known for its top-rated schools, University Station lifestyle center, and beautiful residential neighborhoods.",
    history: "Westwood was incorporated in 1897 from portions of Dedham and Medfield. The town has grown into one of Greater Boston's most desirable suburbs, with excellent schools and a strong community. Westwood's Colonials, Tudors, and contemporaries on generous lots are ideal candidates for the premium additions and remodeling work Coen Construction delivers.",
    landmark: "University Station & Hale Reservation",
    services: BASE_SERVICES,
    nearbyTowns: ["Dedham", "Norwood", "Medfield", "Walpole", "Canton"],
    faqs: [
      { q: "What is University Station in Westwood?", a: "University Station is Westwood's premier lifestyle center featuring retail, restaurants, and a commuter rail station with direct service to downtown Boston — making Westwood an excellent commuter suburb." },
      { q: "What renovations are most popular in Westwood?", a: "Luxury kitchen remodels, home additions, custom carpentry, and premium outdoor living spaces are most popular in Westwood's Colonials and contemporaries." },
      { q: "Does Coen Construction serve all of Westwood?", a: "Yes — we serve all of Westwood including University Station, Islington, and all surrounding residential neighborhoods." },
      { q: "What is Hale Reservation?", a: "Hale Reservation is a beautiful 1,200-acre camp and conference center in Westwood offering nature programs and outdoor activities. Many of our clients live in the surrounding neighborhoods." },
      { q: "What permits are required in Westwood?", a: "Westwood requires building permits from the Building Department for all structural work and major renovations. We handle all permitting as part of our service." }
    ],
    img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"
  },
  dover: {
    name: "Dover", county: "Norfolk County", state: "MA", zip: "02030",
    region: "Metro West",
    desc: "Dover is one of Massachusetts' wealthiest and most exclusive communities — horse country with expansive estates, conservation land, and the highest per-capita income in the state.",
    history: "Incorporated in 1836, Dover has carefully preserved its rural, equestrian character. With strict zoning that maintains large minimum lot sizes, Dover is home to some of the most spectacular private estates in New England. The town borders Sherborn, Needham, Wellesley, and Medfield, and is served by the Charles River corridor. Coen Construction works on many of Dover's finest estate properties.",
    landmark: "Dover-Sherborn Regional Schools & Noanet Woodlands",
    services: BASE_SERVICES,
    nearbyTowns: ["Sherborn", "Medfield", "Wellesley", "Needham", "Westwood"],
    faqs: [
      { q: "What makes Dover homes unique?", a: "Dover has some of the largest and most exclusive private estates in Massachusetts. Many homes sit on 2–10+ acre lots with carriage houses, barns, and extensive grounds." },
      { q: "What renovations are popular in Dover?", a: "Large-scale luxury home additions, premium custom carpentry, high-end kitchen and bath remodels, and extensive outdoor living spaces are most common in Dover." },
      { q: "Do you work on estate properties in Dover?", a: "Yes — Coen Construction has extensive experience with large-scale estate renovations in Dover, including main house additions, carriage house conversions, and comprehensive remodels." },
      { q: "What is Noanet Woodlands?", a: "Noanet Woodlands is a 695-acre Trustees of Reservations property in Dover offering hiking through old mill sites and beautiful forest. Many of our Dover clients live adjacent to this conservation land." },
      { q: "What permits are required for Dover projects?", a: "Dover requires building permits from the Building Department. Large projects may also require Conservation Commission approval due to the town's extensive wetlands and conservation restrictions." }
    ],
    img: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1200&q=80"
  },
  sherborn: {
    name: "Sherborn", county: "Middlesex County", state: "MA", zip: "01770",
    region: "Metro West",
    desc: "Sherborn is a small, rural gem in Metro West — conservation-rich countryside with beautiful horse farms, the Farm Pond, and a deeply community-oriented character.",
    history: "Incorporated in 1674, Sherborn is one of the smaller and more rural communities in the Metro West region. Farm Pond, one of the cleanest natural swimming ponds in Massachusetts, is a beloved community landmark. Sherborn's custom-built estates and older colonial farmhouses offer excellent renovation opportunities for discerning homeowners.",
    landmark: "Farm Pond & Rocky Narrows Reservation",
    services: BASE_SERVICES,
    nearbyTowns: ["Dover", "Medfield", "Holliston", "Natick", "Framingham"],
    faqs: [
      { q: "What is Farm Pond in Sherborn?", a: "Farm Pond is a beautiful natural pond in Sherborn, one of the cleanest in Massachusetts, offering swimming, kayaking, and picnicking in a pristine natural setting." },
      { q: "What types of homes does Coen Construction work on in Sherborn?", a: "Sherborn has a mix of colonial farmhouses, custom contemporaries, and estate homes on large lots. We work on all styles and deliver craftsmanship appropriate to each home's character." },
      { q: "What renovations are popular in Sherborn?", a: "Home additions, luxury kitchen remodels, and premium outdoor living spaces are popular in Sherborn, where homeowners value quality and longevity over cost-cutting." },
      { q: "Are there wetlands restrictions in Sherborn?", a: "Yes — Sherborn has significant wetlands and conservation restrictions. We work with the town's Conservation Commission and local engineers to ensure all projects comply." },
      { q: "How do I get a free estimate in Sherborn?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day and schedule free in-home estimates throughout Sherborn." }
    ],
    img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"
  },
  holliston: {
    name: "Holliston", county: "Middlesex County", state: "MA", zip: "01746",
    region: "Metro West",
    desc: "Holliston is a charming suburban town in Metro West known for its beautiful Reservoir, historic mill village, and the popular Upper Charles Rail Trail.",
    history: "Incorporated in 1724, Holliston was historically a shoe manufacturing center and later a hub for electronics manufacturing. The Holliston Reservoir offers beautiful scenery, and the Upper Charles Rail Trail provides excellent recreation. Holliston's Capes, Colonials, and raised ranches are prime renovation candidates.",
    landmark: "Holliston Reservoir & Upper Charles Rail Trail",
    services: BASE_SERVICES,
    nearbyTowns: ["Ashland", "Medway", "Sherborn", "Hopkinton", "Millis"],
    faqs: [
      { q: "What is the Upper Charles Rail Trail in Holliston?", a: "The Upper Charles Rail Trail is a multi-use paved path running through Holliston, Hopkinton, Milford, and Millis. Many of our Holliston clients live along this beautiful corridor." },
      { q: "What renovations are popular in Holliston?", a: "Home additions, deck construction, kitchen remodels, and siding replacements are popular in Holliston's Capes, Colonials, and raised ranches." },
      { q: "Does Coen Construction serve all of Holliston?", a: "Yes — we serve all of Holliston including Town Center, Dalton Road, Reservoir area, and all surrounding neighborhoods." },
      { q: "Can I add a deck with views of the Holliston Reservoir?", a: "Yes — we design and build decks and outdoor living spaces throughout Holliston. Properties near the Reservoir may have wetlands setback requirements which we navigate carefully." },
      { q: "How do I get a free estimate in Holliston?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560184897-502a475f7a0d?w=1200&q=80"
  },
  medway: {
    name: "Medway", county: "Norfolk County", state: "MA", zip: "02053",
    region: "Metro West",
    desc: "Medway is a peaceful suburban town along the Charles River in southwestern Metro West, with a growing residential community and excellent access to Route 495.",
    history: "Incorporated in 1713, Medway has historically been an agricultural and manufacturing community. The town's Charles River frontage provides beautiful natural scenery. Medway's mix of older Colonials, Capes, and newer subdivisions offer varied renovation opportunities for Coen Construction.",
    landmark: "Medway Town Green & Charles River Corridor",
    services: BASE_SERVICES,
    nearbyTowns: ["Millis", "Medfield", "Holliston", "Franklin", "Bellingham"],
    faqs: [
      { q: "Does Coen Construction serve Medway, MA?", a: "Yes — we proudly serve Medway and all surrounding Metro West communities." },
      { q: "What services do you offer in Medway?", a: "Home additions, deck and pergola construction, siding installation, kitchen remodeling, custom carpentry, and snow removal." },
      { q: "What renovations are popular in Medway?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Medway's Capes, Colonials, and contemporary homes." },
      { q: "Can you build near the Charles River in Medway?", a: "Yes — we work on properties throughout Medway including those near the Charles River. Wetlands setback requirements apply and we navigate these carefully with the town's Conservation Commission." },
      { q: "How do I get a free estimate in Medway?", a: "Call (617) 857-COEN or fill out our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80"
  },
  ashland: {
    name: "Ashland", county: "Middlesex County", state: "MA", zip: "01721",
    region: "Metro West",
    desc: "Ashland is a growing Metro West community with beautiful Ashland State Park, the Sudbury Reservoir, and easy access to Route 495 and the commuter rail.",
    history: "Incorporated in 1846 from portions of Framingham, Holliston, and Hopkinton, Ashland has evolved from a railroad and manufacturing town into a growing residential suburb. The Boston Marathon historically began in Ashland (before the course was extended to Hopkinton). Ashland's mix of older and newer homes offer solid renovation opportunities.",
    landmark: "Ashland State Park & Historic Marathon Start",
    services: BASE_SERVICES,
    nearbyTowns: ["Hopkinton", "Holliston", "Framingham", "Natick", "Southborough"],
    faqs: [
      { q: "Did the Boston Marathon start in Ashland?", a: "Yes! The original Boston Marathon starting line was in Ashland. In 1924, the course was extended to its current start in Hopkinton to make the distance a full 26.2 miles." },
      { q: "What is Ashland State Park?", a: "Ashland State Park is a beautiful recreation area featuring Ashland Reservoir for swimming, fishing, and boating. It's a popular destination for Ashland and surrounding communities." },
      { q: "What renovations are popular in Ashland?", a: "Kitchen remodels, home additions, deck construction, and siding replacements are popular in Ashland's Capes, Colonials, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Ashland?", a: "Yes — we serve all of Ashland including Town Center, Unionville, and all surrounding residential neighborhoods." },
      { q: "How do I get a free estimate in Ashland?", a: "Call (617) 857-COEN or submit our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"
  },
  hopkinton: {
    name: "Hopkinton", county: "Middlesex County", state: "MA", zip: "01748",
    region: "Metro West",
    desc: "Hopkinton is world-famous as the starting line of the Boston Marathon — every April, 30,000 runners begin their 26.2-mile journey here on Hopkinton Green.",
    history: "Incorporated in 1715, Hopkinton is best known globally as the start of the Boston Marathon. The starting line on Main Street near Hopkinton Green is one of the most photographed spots in road racing. Hopkinton has also grown rapidly as a residential community, with beautiful Colonials, Tudors, and estates along the Sudbury River corridor.",
    landmark: "Boston Marathon Starting Line on Hopkinton Green",
    services: BASE_SERVICES,
    nearbyTowns: ["Ashland", "Holliston", "Milford", "Upton", "Southborough"],
    faqs: [
      { q: "Is Hopkinton really where the Boston Marathon starts?", a: "Yes! Every Patriots' Day, 30,000+ runners line up at the Boston Marathon starting line on Main Street in Hopkinton. The run to Boylston Street in downtown Boston covers exactly 26.2 miles." },
      { q: "What renovations are popular in Hopkinton?", a: "Home additions, kitchen remodels, luxury outdoor living spaces, and custom carpentry are very popular in Hopkinton's growing residential neighborhoods." },
      { q: "Does Coen Construction serve all of Hopkinton?", a: "Yes — we serve all of Hopkinton including the Town Center, Legacy Farms, Wood Street corridor, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Hopkinton?", a: "Hopkinton requires building permits from the Building Department for structural work and major renovations. We handle all permitting as part of our project management." },
      { q: "Can you add a deck to a home near the Sudbury River in Hopkinton?", a: "Yes — we design and build decks and outdoor living spaces throughout Hopkinton. Properties near the Sudbury River may have conservation requirements which we navigate carefully." }
    ],
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80"
  },
  framingham: {
    name: "Framingham", county: "Middlesex County", state: "MA", zip: "01701",
    region: "Metro West",
    desc: "Framingham — elevated to city status in 2018 — is the largest community in Metro West, a diverse hub with a rich Portuguese-American culture, the Framingham State University, and the Garden City shopping district.",
    history: "Incorporated as a town in 1700, Framingham became Massachusetts' 52nd city in 2018. It's the economic and cultural hub of Metro West, home to Framingham State University, the landmark Shoppers World mall, and a large Portuguese and Brazilian immigrant community centered along Route 135 and Union Ave. Framingham's diverse housing stock ranges from historic Colonials to mid-century capes and 1990s subdivisions.",
    landmark: "Framingham State University & Cochituate State Park",
    services: BASE_SERVICES,
    nearbyTowns: ["Natick", "Ashland", "Wayland", "Sudbury", "Holliston"],
    faqs: [
      { q: "When did Framingham become a city?", a: "Framingham became Massachusetts' 52nd city on January 1, 2018, after voters approved the change from town to city government in a 2017 referendum." },
      { q: "What is Cochituate State Park?", a: "Cochituate State Park is a beautiful recreation area centered on Lake Cochituate, offering swimming, boating, and fishing. It's one of the most popular outdoor destinations in Metro West." },
      { q: "What neighborhoods in Framingham does Coen Construction serve?", a: "We serve all of Framingham including Saxonville, Nobscot, Edgell Road corridor, Framingham Center, South Framingham, and all surrounding neighborhoods." },
      { q: "What renovations are popular in Framingham?", a: "Kitchen remodels, home additions, siding replacements, and deck construction are very popular across Framingham's diverse housing stock." },
      { q: "What permits are required for renovations in Framingham?", a: "Framingham requires building permits from the Inspectional Services Department. We handle all permitting as part of our full-service project management." }
    ],
    img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80"
  },
  natick: {
    name: "Natick", county: "Middlesex County", state: "MA", zip: "01760",
    region: "Metro West",
    desc: "Natick is a vibrant Metro West community home to the Natick Collection (one of New England's premier malls), Lake Cochituate, and a strong community with excellent schools.",
    history: "Incorporated in 1651, Natick was one of the first 'Praying Indian' towns established by Puritan missionary John Eliot. Today, Natick is a thriving suburb with strong commercial and residential sectors. The Boston Marathon passes through Natick center around mile 10, and Lake Cochituate provides beautiful recreational opportunities for residents.",
    landmark: "Natick Collection Mall & Lake Cochituate",
    services: BASE_SERVICES,
    nearbyTowns: ["Framingham", "Wayland", "Wellesley", "Ashland", "Holliston"],
    faqs: [
      { q: "What is the Natick Collection?", a: "The Natick Collection is one of New England's premier retail destinations, featuring high-end shops, restaurants, and the iconic Natick Mall. It's one of the largest malls in New England." },
      { q: "Does the Boston Marathon pass through Natick?", a: "Yes — the Boston Marathon passes through Natick center around mile 10, with large crowds lining the route each Patriots' Day." },
      { q: "What renovations are popular in Natick?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Natick's Colonials, Capes, and mid-century homes." },
      { q: "Does Coen Construction serve all of Natick?", a: "Yes — we serve all of Natick including South Natick, Natick Center, West Natick, and all surrounding residential neighborhoods." },
      { q: "Can I build a deck near Lake Cochituate in Natick?", a: "Yes — we design and build decks throughout Natick. Lakefront properties may have wetlands setback requirements which we navigate carefully with the Conservation Commission." }
    ],
    img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80"
  },
  wayland: {
    name: "Wayland", county: "Middlesex County", state: "MA", zip: "01778",
    region: "Metro West",
    desc: "Wayland is a beautiful, low-density suburb along the Sudbury River with excellent schools, vast conservation land, and the historic Great Meadows National Wildlife Refuge.",
    history: "Incorporated in 1780, Wayland was originally known as East Sudbury. The town has preserved extraordinary amounts of open space, including portions of the Great Meadows National Wildlife Refuge along the Sudbury River. Wayland's beautiful Colonials, Contemporaries, and Tudors on generous lots are ideal for the premium renovations Coen Construction delivers.",
    landmark: "Great Meadows National Wildlife Refuge",
    services: BASE_SERVICES,
    nearbyTowns: ["Sudbury", "Natick", "Framingham", "Weston", "Lincoln"],
    faqs: [
      { q: "What is the Great Meadows National Wildlife Refuge?", a: "Great Meadows NWR is a spectacular 3,800-acre refuge along the Concord and Sudbury Rivers, offering world-class birding and wildlife viewing. Portions of it run through Wayland." },
      { q: "What types of homes does Coen Construction work on in Wayland?", a: "Wayland has beautiful Colonials, Contemporaries, Tudors, and Capes on generous lots — often bordering conservation land. We work on all styles and deliver premium craftsmanship." },
      { q: "What renovations are popular in Wayland?", a: "Luxury home additions, premium kitchen remodels, custom carpentry, and high-end outdoor living spaces are popular in Wayland." },
      { q: "Are there conservation restrictions in Wayland?", a: "Yes — many Wayland properties are adjacent to wetlands or conservation land. We work carefully with the Conservation Commission to ensure all projects comply." },
      { q: "How do I get a free estimate in Wayland?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"
  },
  sudbury: {
    name: "Sudbury", county: "Middlesex County", state: "MA", zip: "01776",
    region: "Metro West",
    desc: "Sudbury is a historic, conservation-rich suburb famous for Longfellow's Wayside Inn — America's oldest operating inn — and vast conservation land along the Sudbury River.",
    history: "Incorporated in 1639, Sudbury was the site of significant conflict during King Philip's War. Henry Wadsworth Longfellow immortalized the Wayside Inn in his 'Tales of a Wayside Inn' (1863). The inn, dating to 1702, is still open and one of New England's most beloved historic landmarks. Sudbury's beautiful homes on large lots reflect the town's affluent, conservation-minded character.",
    landmark: "Longfellow's Wayside Inn (est. 1702)",
    services: BASE_SERVICES,
    nearbyTowns: ["Wayland", "Concord", "Lincoln", "Hudson", "Framingham"],
    faqs: [
      { q: "What is Longfellow's Wayside Inn?", a: "Longfellow's Wayside Inn, dating to 1702, is America's oldest operating inn. Immortalized by Henry Wadsworth Longfellow in 'Tales of a Wayside Inn,' it's a National Historic Landmark and beloved dining destination." },
      { q: "What types of homes does Coen Construction work on in Sudbury?", a: "Sudbury has beautiful Colonials, Contemporaries, and estate homes on large lots — often adjacent to conservation land. We deliver premium craftsmanship appropriate to each home's character." },
      { q: "What renovations are popular in Sudbury?", a: "Large home additions, luxury kitchen and bath remodels, custom carpentry, and premium outdoor living spaces are most popular in Sudbury." },
      { q: "Are there conservation restrictions in Sudbury?", a: "Yes — Sudbury has extensive wetlands and conservation restrictions. We work carefully with the town's Conservation Commission on all projects near sensitive areas." },
      { q: "How do I get a free estimate in Sudbury?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80"
  },
  watertown: {
    name: "Watertown", county: "Middlesex County", state: "MA", zip: "02472",
    region: "Metro West",
    desc: "Watertown is a vibrant, rapidly evolving city on the Charles River, famous as the site of the 2013 Tsarnaev manhunt and now a booming biotech and life sciences hub.",
    history: "Incorporated in 1630, Watertown is one of Massachusetts' oldest cities. It was the site of the final capture of the Boston Marathon bomber in 2013. Today, Watertown is booming as a biotech and life sciences hub, with the Arsenal on the Charles — a former Civil War-era federal weapons manufacturing facility — transformed into a vibrant mixed-use development.",
    landmark: "Arsenal on the Charles & Charles River Bike Path",
    services: BASE_SERVICES,
    nearbyTowns: ["Newton", "Waltham", "Belmont", "Cambridge", "Allston"],
    faqs: [
      { q: "What is the Arsenal on the Charles?", a: "The Arsenal on the Charles is a 36-acre mixed-use development built on the historic Watertown Arsenal site, a Civil War-era federal weapons facility. It now houses offices, retail, and restaurants." },
      { q: "What renovations are popular in Watertown?", a: "Kitchen remodels, siding replacements, home additions, and custom carpentry are popular in Watertown's mix of triple-deckers, Capes, and Colonials." },
      { q: "Does Coen Construction serve all of Watertown?", a: "Yes — we serve all of Watertown including Watertown Square, East Watertown, West Watertown, and all surrounding neighborhoods." },
      { q: "Can you build a deck near the Charles River in Watertown?", a: "Yes — decks and outdoor living spaces near the Charles River are popular in Watertown. Riparian setbacks apply and we navigate these carefully." },
      { q: "What permits are required in Watertown?", a: "Watertown requires building permits from the Building Department for structural work. We handle all permitting as part of our project management." }
    ],
    img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80"
  },

  // ─── SOUTH SHORE ──────────────────────────────────────────────────
  plymouth: {
    name: "Plymouth", county: "Plymouth County", state: "MA", zip: "02360",
    region: "South Shore",
    desc: "Plymouth is America's 'Hometown' — the site of the Pilgrims' landing in 1620, Plymouth Rock, and Plimoth Patuxent — a beautiful coastal town with a rich heritage and growing residential community.",
    history: "Plymouth is where the Pilgrims landed aboard the Mayflower in 1620, establishing the Plymouth Colony. Plymouth Rock marks the legendary landing site on the waterfront. The reconstructed Plimoth Patuxent living museum brings this history to life. Today, Plymouth is a large coastal town with significant residential development, offering beautiful waterfront and inland renovation opportunities.",
    landmark: "Plymouth Rock & Plimoth Patuxent",
    services: BASE_SERVICES,
    nearbyTowns: ["Kingston", "Duxbury", "Marshfield", "Pembroke", "Carver"],
    faqs: [
      { q: "What is Plymouth Rock?", a: "Plymouth Rock is the legendary landing site of the Pilgrims when they arrived on the Mayflower in 1620. Located on Plymouth waterfront at Pilgrim Memorial State Park, it's one of America's most visited historic sites." },
      { q: "What renovations are popular in Plymouth?", a: "Waterfront deck and porch additions, home additions, kitchen remodels, and siding replacements are very popular in Plymouth, particularly on the town's extensive Cape-style and Colonial homes." },
      { q: "What siding is best for Plymouth's coastal location?", a: "James Hardie fiber cement siding is ideal for Plymouth's coastal environment — it resists salt air, moisture, and freeze-thaw cycles far better than wood or vinyl." },
      { q: "Does Coen Construction serve all of Plymouth?", a: "Yes — we serve all of Plymouth including the waterfront, Manomet, Cedarville, Chiltonville, Ellisville, and all surrounding neighborhoods." },
      { q: "Can you build a waterfront deck in Plymouth?", a: "Yes — waterfront deck and outdoor living additions are among our most popular projects in Plymouth. Coastal setback and conservation requirements apply and we navigate these carefully." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  milton: {
    name: "Milton", county: "Norfolk County", state: "MA", zip: "02186",
    region: "South Shore",
    desc: "Milton is one of Greater Boston's most prestigious communities — the hilltop Blue Hills Reservation, stunning estates, and the Governor's official residence make it a uniquely desirable suburb.",
    history: "Incorporated in 1662, Milton has long been one of Boston's most exclusive suburbs. The Blue Hills Reservation spans 7,000 acres and provides spectacular views of Boston Harbor and the downtown skyline. Milton Hill is home to the Governor's official residence. Many of Milton's stunning Colonials, Tudors, and Georgians are prime renovation candidates.",
    landmark: "Blue Hills Reservation & Governor's Mansion",
    services: BASE_SERVICES,
    nearbyTowns: ["Quincy", "Canton", "Dedham", "Dorchester", "Hyde Park"],
    faqs: [
      { q: "What is the Blue Hills Reservation?", a: "The Blue Hills Reservation is a 7,000-acre state reservation in Milton, Canton, and Randolph — the largest open space within 35 miles of Boston. It offers hiking, skiing, and panoramic views of Boston Harbor." },
      { q: "What renovations are popular in Milton?", a: "Luxury home additions, premium kitchen and bath remodels, custom carpentry (built-ins, coffered ceilings), and high-end outdoor living spaces are most popular in Milton." },
      { q: "What types of homes does Coen Construction work on in Milton?", a: "Milton has stunning Colonials, Tudors, Georgians, and mid-century homes on generous lots. We work on all styles and deliver the premium craftsmanship Milton homeowners expect." },
      { q: "Does Coen Construction serve all of Milton?", a: "Yes — we serve all of Milton including Milton Village, East Milton, Mattapan (Milton side), and all surrounding residential neighborhoods." },
      { q: "What permits are required in Milton?", a: "Milton requires building permits from the Building Department for structural work. We handle all permitting as part of our project management service." }
    ],
    img: "https://images.unsplash.com/photo-1568010434929-06e7c8d8bcfe?w=1200&q=80"
  },
  easton: {
    name: "Easton", county: "Bristol County", state: "MA", zip: "02356",
    region: "South Shore",
    desc: "Easton is a beautiful suburban town known for its stunning Ames estate architecture by H.H. Richardson, the vibrant Easton Village Center, and excellent access to Routes 138 and 106.",
    history: "Incorporated in 1725, Easton is famous for the Ames family — ironmasters who built massive shovel manufacturing fortunes. The North Easton village is a National Historic Landmark district featuring multiple buildings designed by H.H. Richardson (the same architect as Trinity Church in Boston), commissioned by the Ames family in the 1870s–1880s.",
    landmark: "North Easton Village (H.H. Richardson Architecture)",
    services: BASE_SERVICES,
    nearbyTowns: ["Stoughton", "Sharon", "Canton", "Mansfield", "Brockton"],
    faqs: [
      { q: "What are the H.H. Richardson buildings in Easton?", a: "North Easton village contains five buildings designed by legendary architect H.H. Richardson, commissioned by the Ames family: the Ames Free Library, Oakes Ames Memorial Hall, F.L. Ames Gate Lodge, and others. It's a National Historic Landmark district." },
      { q: "What renovations are popular in Easton?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular across Easton's Colonials, Capes, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Easton?", a: "Yes — we serve all of Easton including North Easton, South Easton, Easton Village, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Easton?", a: "Easton requires building permits from the Building Department. North Easton historic district properties may need Historical Commission review — we navigate this for you." },
      { q: "How do I get a free estimate in Easton?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80"
  },
  sharon: {
    name: "Sharon", county: "Norfolk County", state: "MA", zip: "02067",
    region: "South Shore",
    desc: "Sharon is a beautiful South Shore community centered around Lake Massapoag — the largest natural lake in Norfolk County — with excellent schools and a charming town center.",
    history: "Incorporated in 1765, Sharon has grown into a highly desirable suburb known for its excellent schools and Lake Massapoag, which provides beautiful recreational opportunities. The lake and its surrounding neighborhoods feature some of Sharon's most beautiful homes. Sharon's proximity to the MBTA commuter rail makes it an attractive community for Boston commuters.",
    landmark: "Lake Massapoag — Largest Natural Lake in Norfolk County",
    services: BASE_SERVICES,
    nearbyTowns: ["Stoughton", "Easton", "Canton", "Norwood", "Foxborough"],
    faqs: [
      { q: "What is Lake Massapoag?", a: "Lake Massapoag is the largest natural lake in Norfolk County, located in Sharon. It's a popular swimming, boating, and fishing destination for Sharon residents and visitors." },
      { q: "What renovations are popular in Sharon?", a: "Home additions, deck and waterfront porch construction, kitchen remodels, and siding replacements are popular in Sharon, particularly on homes near Lake Massapoag." },
      { q: "Can you build a lakefront deck in Sharon?", a: "Yes — we design and build lakefront decks and outdoor living spaces in Sharon. Conservation and wetlands setback requirements apply near Lake Massapoag and we navigate these carefully." },
      { q: "Does Coen Construction serve all of Sharon?", a: "Yes — we serve all of Sharon including Sharon Center, Lake Massapoag area, East Sharon, and all surrounding residential neighborhoods." },
      { q: "How do I get a free estimate in Sharon?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  stoughton: {
    name: "Stoughton", county: "Norfolk County", state: "MA", zip: "02072",
    region: "South Shore",
    desc: "Stoughton is the proud home of Coen Construction's headquarters. A vibrant South Shore community with excellent schools, Canton Junction access, and growing residential development.",
    history: "Incorporated in 1726, Stoughton was historically famous for its shoe manufacturing industry — at its peak, Stoughton produced more shoes than anywhere else in the US. Today, Stoughton is a diverse, growing community with excellent access to Routes 24 and 138, the Canton Junction commuter rail station, and a strong local business community.",
    landmark: "Coen Construction HQ & Canton Junction Commuter Rail",
    services: BASE_SERVICES,
    nearbyTowns: ["Canton", "Sharon", "Easton", "Randolph", "Norwood"],
    faqs: [
      { q: "Is Coen Construction based in Stoughton?", a: "Yes! Coen Construction's headquarters is at 387 Page Street, Suite 10B in Stoughton, MA 02072. We're proud to call Stoughton home and serve this community and all of Greater Boston." },
      { q: "What renovations are popular in Stoughton?", a: "Home additions, kitchen remodels, deck construction, siding replacements, and custom carpentry are very popular across Stoughton's Colonials, Capes, and newer homes." },
      { q: "What was Stoughton historically known for?", a: "Stoughton was once the shoe manufacturing capital of the United States, producing more shoes than any other location in the country during the 19th and early 20th centuries." },
      { q: "Does Coen Construction serve all of Stoughton?", a: "Yes — we serve all of Stoughton including Stoughton Center, South Stoughton, West Stoughton, and all surrounding neighborhoods. As our hometown, Stoughton is near and dear to us." },
      { q: "What permits are required in Stoughton?", a: "Stoughton requires building permits from the Building Department for structural work and major renovations. As a Stoughton-based company, we have an excellent relationship with town permitting offices." }
    ],
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
  },
  mansfield: {
    name: "Mansfield", county: "Bristol County", state: "MA", zip: "02048",
    region: "South Shore",
    desc: "Mansfield is a vibrant South Shore community known for the Xfinity Center (one of New England's premier outdoor concert venues) and excellent access to I-95 and the commuter rail.",
    history: "Incorporated in 1775, Mansfield has grown into a significant suburban hub with major commercial development along Route 106 and I-95. The Xfinity Center (formerly Tweeter Center / Great Woods) has hosted major concerts since 1986, drawing hundreds of thousands of visitors annually. Mansfield's residential neighborhoods feature solid Colonials, Capes, and newer subdivisions.",
    landmark: "Xfinity Center Amphitheater",
    services: BASE_SERVICES,
    nearbyTowns: ["Foxborough", "Easton", "Norton", "Attleboro", "Sharon"],
    faqs: [
      { q: "What is the Xfinity Center in Mansfield?", a: "The Xfinity Center is one of New England's premier outdoor amphitheaters, hosting major concerts and touring acts throughout the summer season. Opened in 1986 (originally as Great Woods), it seats over 19,000." },
      { q: "What renovations are popular in Mansfield?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Mansfield's Colonials, Capes, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Mansfield?", a: "Yes — we serve all of Mansfield including Mansfield Center, East Mansfield, West Mansfield, and all surrounding residential neighborhoods." },
      { q: "What permits are needed for renovations in Mansfield?", a: "Mansfield requires building permits from the Building Department. We handle all permitting as part of our project management service." },
      { q: "How do I get a free estimate in Mansfield?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1548777123-e216912df7d8?w=1200&q=80"
  },
  foxborough: {
    name: "Foxborough", county: "Norfolk County", state: "MA", zip: "02035",
    region: "South Shore",
    desc: "Foxborough is home to Gillette Stadium — home of the New England Patriots and Revolution — and is a rapidly growing South Shore community with excellent highway access.",
    history: "Incorporated in 1778, Foxborough is best known today as the home of Gillette Stadium, opened in 2002. The town has grown significantly with development around the stadium and along the I-95 corridor. Foxborough's residential neighborhoods feature a mix of older Colonials and Capes alongside newer developments.",
    landmark: "Gillette Stadium — Home of the New England Patriots",
    services: BASE_SERVICES,
    nearbyTowns: ["Mansfield", "Walpole", "Norfolk", "Sharon", "Plainville"],
    faqs: [
      { q: "Is Gillette Stadium in Foxborough?", a: "Yes! Gillette Stadium, home of the New England Patriots (NFL) and New England Revolution (MLS), is located in Foxborough. Opened in 2002, it seats 65,878 for football and is one of the most modern stadiums in the NFL." },
      { q: "What renovations are popular in Foxborough?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Foxborough's Colonials, Capes, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Foxborough?", a: "Yes — we serve all of Foxborough including Foxborough Center, East Foxborough, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Foxborough?", a: "Foxborough requires building permits from the Building Department for structural work and major renovations. We handle all permitting as part of our project management." },
      { q: "How do I get a free estimate in Foxborough?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80"
  },
  norfolk: {
    name: "Norfolk", county: "Norfolk County", state: "MA", zip: "02056",
    region: "South Shore",
    desc: "Norfolk is a quiet, rural Norfolk County town with a tight-knit community, beautiful Populatic Pond, and a peaceful small-town character ideal for families.",
    history: "Incorporated in 1870 from portions of Franklin, Medfield, Millis, Medway, and Wrentham, Norfolk has maintained its small-town rural character. The town is known for Populatic Pond and the Norfolk County correctional facility. Norfolk's mix of Colonials, Capes, and newer homes on good-sized lots appeal to families seeking a quieter lifestyle within commuting distance of Boston.",
    landmark: "Populatic Pond & King Philip Trail",
    services: BASE_SERVICES,
    nearbyTowns: ["Walpole", "Foxborough", "Millis", "Medway", "Franklin"],
    faqs: [
      { q: "Does Coen Construction serve Norfolk, MA?", a: "Yes — Coen Construction proudly serves Norfolk and all surrounding South Shore and Metro West communities." },
      { q: "What renovations are popular in Norfolk?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Norfolk's Colonials, Capes, and larger-lot homes." },
      { q: "What is Populatic Pond in Norfolk?", a: "Populatic Pond is a beautiful natural pond in Norfolk, offering swimming and fishing for residents. Many of our clients live in the surrounding neighborhoods." },
      { q: "What permits are required in Norfolk?", a: "Norfolk requires building permits from the Building Department for structural work. We handle all permitting as part of our project management service." },
      { q: "How do I get a free estimate in Norfolk?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560184897-502a475f7a0d?w=1200&q=80"
  },
  walpole: {
    name: "Walpole", county: "Norfolk County", state: "MA", zip: "02081",
    region: "South Shore",
    desc: "Walpole is a scenic South Shore community along the Neponset River with a charming town center, the Trustees Noon Hill Reservation, and beautiful residential neighborhoods.",
    history: "Incorporated in 1724, Walpole has a rich industrial history along the Neponset River. The town is known for its beautiful Town Farm, extensive conservation land, and excellent schools. Walpole's commuter rail service and easy highway access make it popular with Boston commuters. Its Colonials, Capes, and Tudors are excellent renovation candidates.",
    landmark: "Walpole Town Center & Neponset River Reservation",
    services: BASE_SERVICES,
    nearbyTowns: ["Norwood", "Foxborough", "Norfolk", "Medfield", "Westwood"],
    faqs: [
      { q: "What is Walpole known for?", a: "Walpole is known for its beautiful Town Farm conservation land, the Neponset River Reservation, excellent schools, and easy commuter rail access to Boston's South Station." },
      { q: "What renovations are popular in Walpole?", a: "Home additions, kitchen remodels, deck construction, siding replacements, and custom carpentry are popular in Walpole's Colonials, Capes, and Tudors." },
      { q: "Does Coen Construction serve all of Walpole?", a: "Yes — we serve all of Walpole including Walpole Center, South Walpole, East Walpole, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Walpole?", a: "Walpole requires building permits from the Building Department. We handle all permitting as part of our project management service." },
      { q: "Can you build a deck near the Neponset River in Walpole?", a: "Yes — we design and build decks throughout Walpole. Properties near the Neponset River may have conservation requirements which we navigate carefully." }
    ],
    img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"
  },
  norwood: {
    name: "Norwood", county: "Norfolk County", state: "MA", zip: "02062",
    region: "South Shore",
    desc: "Norwood is a dynamic South Shore community with a thriving commercial corridor, Norwood Memorial Airport, and strong residential neighborhoods close to Routes 95 and 1.",
    history: "Incorporated in 1872, Norwood has evolved from an industrial town (Norwood Press, printing) into a vibrant commercial and residential hub. Norwood Memorial Airport (OWD) is one of the busiest general aviation airports in New England. Norwood's proximity to I-95 and Routes 1 and 128 makes it highly accessible and a strong market for home renovation investment.",
    landmark: "Norwood Memorial Airport & Norwood Theater",
    services: BASE_SERVICES,
    nearbyTowns: ["Dedham", "Westwood", "Walpole", "Canton", "Foxborough"],
    faqs: [
      { q: "What is Norwood Memorial Airport?", a: "Norwood Memorial Airport (OWD) is one of the busiest general aviation airports in New England, offering charter, flight training, and aircraft rental services. It's located just off Route 1 in Norwood." },
      { q: "What renovations are popular in Norwood?", a: "Kitchen remodels, home additions, siding replacements, and deck construction are popular in Norwood's Colonials, Capes, and mid-century homes." },
      { q: "Does Coen Construction serve all of Norwood?", a: "Yes — we serve all of Norwood including Norwood Center, East Norwood, South Norwood, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Norwood?", a: "Norwood requires building permits from the Building Department. We handle all permitting as part of our project management service." },
      { q: "How do I get a free estimate in Norwood?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80"
  },
  canton: {
    name: "Canton", county: "Norfolk County", state: "MA", zip: "02021",
    region: "South Shore",
    desc: "Canton is a beautiful South Shore community on the edge of the Blue Hills, known for its excellent schools, the historic Canton Viaduct, and growing residential and commercial development.",
    history: "Incorporated in 1797, Canton has a rich industrial history — the country's first chocolate mill was established here by Dr. James Baker in 1765 (Baker's Chocolate). The Blue Hills Reservation borders Canton to the north, providing spectacular recreational opportunities. The Canton Viaduct, built in 1835, is the longest active stone railroad bridge in the US.",
    landmark: "Blue Hills Reservation & Canton Viaduct (1835)",
    services: BASE_SERVICES,
    nearbyTowns: ["Stoughton", "Sharon", "Milton", "Randolph", "Dedham"],
    faqs: [
      { q: "What is the Canton Viaduct?", a: "The Canton Viaduct, built in 1835, is the longest active stone arch railroad bridge in the United States at 615 feet. It carries the MBTA commuter rail and is one of the finest examples of early American engineering." },
      { q: "Did Baker's Chocolate originate in Canton?", a: "Yes! Dr. James Baker established the first chocolate mill in America on the Neponset River in Canton in 1765. Baker's Chocolate (now owned by Kraft) traces its origins to Canton." },
      { q: "What renovations are popular in Canton?", a: "Home additions, kitchen remodels, deck construction near the Blue Hills, and siding replacements are very popular in Canton's Colonials, Capes, and mid-century homes." },
      { q: "Does Coen Construction serve all of Canton?", a: "Yes — we serve all of Canton including Canton Center, Ponkapoag, the Blue Hills corridor, and all surrounding residential neighborhoods." },
      { q: "Can you build a deck near the Blue Hills Reservation in Canton?", a: "Yes — we design and build decks and outdoor living spaces throughout Canton. Properties adjacent to the Blue Hills have conservation setbacks which we navigate carefully." }
    ],
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
  },
  braintree: {
    name: "Braintree", county: "Norfolk County", state: "MA", zip: "02184",
    region: "South Shore",
    desc: "Braintree is a South Shore hub with South Shore Plaza — one of New England's largest malls — and convenient highway access, birthplace of Presidents John Adams and John Quincy Adams.",
    history: "Incorporated in 1640, Braintree is the birthplace of two US Presidents — John Adams (1735) and John Quincy Adams (1767). The South Shore Plaza, one of the largest shopping centers in New England, anchors its commercial landscape. Braintree has excellent MBTA Red Line access (the southernmost station) and is a major South Shore transportation hub.",
    landmark: "South Shore Plaza & Presidents' Birthplaces (Adams)",
    services: BASE_SERVICES,
    nearbyTowns: ["Quincy", "Weymouth", "Canton", "Randolph", "Milton"],
    faqs: [
      { q: "Were Presidents born in Braintree?", a: "Yes — both John Adams (1735, 2nd President) and John Quincy Adams (1767, 6th President) were born in Braintree (now Quincy). Their birthplaces are preserved as National Historic Sites." },
      { q: "What is South Shore Plaza?", a: "South Shore Plaza is one of the largest shopping malls in New England, featuring over 180 stores and anchored by major department stores. It's a major regional destination for South Shore residents." },
      { q: "What renovations are popular in Braintree?", a: "Kitchen remodels, home additions, siding replacements, and deck construction are popular in Braintree's Colonials, Capes, and mid-century homes." },
      { q: "Does Coen Construction serve all of Braintree?", a: "Yes — we serve all of Braintree including Braintree Center, East Braintree, South Braintree, and all surrounding neighborhoods." },
      { q: "What permits are required in Braintree?", a: "Braintree requires building permits from the Building Department. We handle all permitting as part of our project management service." }
    ],
    img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80"
  },
  quincy: {
    name: "Quincy", county: "Norfolk County", state: "MA", zip: "02169",
    region: "South Shore",
    desc: "Quincy — the 'City of Presidents' — is the birthplace of Presidents John Adams and John Quincy Adams, with a dynamic waterfront and one of Greater Boston's fastest-growing real estate markets.",
    history: "Quincy's granite literally built Boston. The Granite Railway (1826) was the first commercial railroad in the US. The city is the birthplace of Presidents John Adams and John Quincy Adams. Today, Quincy is a dynamic city with a large Asian-American community and a booming real estate market with excellent Red Line transit access.",
    landmark: "Presidents' Birthplaces & Marina Bay Waterfront",
    services: BASE_SERVICES,
    nearbyTowns: ["Braintree", "Milton", "Weymouth", "Boston", "Randolph"],
    faqs: [
      { q: "Why is Quincy called the 'City of Presidents'?", a: "Quincy is the birthplace of two US Presidents: John Adams (2nd) and John Quincy Adams (6th). Both birthplaces are preserved as National Historic Sites on Franklin Street." },
      { q: "What renovations are popular in Quincy?", a: "Siding replacements, kitchen remodels, deck additions near the waterfront, and home additions are very popular across Quincy's diverse housing stock." },
      { q: "Can you build a deck near Quincy's waterfront?", a: "Yes — we build composite and pressure-treated decks and screened porches ideal for Quincy's coastal environment, particularly near Marina Bay and Wollaston Beach." },
      { q: "What siding is best for Quincy's coastal neighborhoods?", a: "James Hardie fiber cement siding is very popular in Quincy because of its resistance to salt air. Vinyl siding is also popular for budget-conscious renovations." },
      { q: "Does Coen Construction serve all Quincy neighborhoods?", a: "Yes — we serve Quincy Center, Quincy Point, Wollaston, North Quincy, Squantum, Merrymount, Germantown, and South Quincy." }
    ],
    img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80"
  },
  weymouth: {
    name: "Weymouth", county: "Norfolk County", state: "MA", zip: "02188",
    region: "South Shore",
    desc: "Weymouth is the birthplace of First Lady Abigail Adams and a growing South Shore city with beautiful Great Pond, excellent schools, and easy highway access.",
    history: "Incorporated in 1635, Weymouth is one of the oldest communities in Massachusetts. Abigail Adams, wife of President John Adams and mother of President John Quincy Adams, was born here in 1744. Great Pond and the Weymouth Back River offer beautiful waterfront living. Weymouth's diverse housing stock ranges from historic Colonials to newer subdivisions.",
    landmark: "Abigail Adams Birthplace & Great Pond",
    services: BASE_SERVICES,
    nearbyTowns: ["Braintree", "Hingham", "Quincy", "Holbrook", "Rockland"],
    faqs: [
      { q: "Was Abigail Adams born in Weymouth?", a: "Yes! Abigail Adams, one of America's most admired First Ladies and mother of the 6th President, was born in Weymouth in 1744. Her birthplace is a historic site in Weymouth." },
      { q: "What renovations are popular in Weymouth?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Weymouth's Colonials, Capes, and mid-century homes." },
      { q: "Can you build near Great Pond in Weymouth?", a: "Yes — we design and build decks and additions near Great Pond. Conservation and wetlands setback requirements apply and we navigate these carefully." },
      { q: "Does Coen Construction serve all of Weymouth?", a: "Yes — we serve all of Weymouth including Weymouth Center, South Weymouth, East Weymouth, North Weymouth, and Weymouth Landing." },
      { q: "What permits are needed for Weymouth renovations?", a: "Weymouth requires building permits from the Building Department. We handle all permitting as part of our project management." }
    ],
    img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"
  },
  hanover: {
    name: "Hanover", county: "Plymouth County", state: "MA", zip: "02339",
    region: "South Shore",
    desc: "Hanover is a family-friendly South Shore community with the popular Hanover Mall area, beautiful Indian Head River, and excellent Route 3 highway access.",
    history: "Incorporated in 1727, Hanover was historically known for iron manufacturing along the Indian Head River. The town has grown into a desirable suburban community with excellent schools and easy highway access. Hanover's mix of Colonials, Capes, and newer subdivisions make it a strong renovation market.",
    landmark: "Indian Head River & Forge Pond",
    services: BASE_SERVICES,
    nearbyTowns: ["Norwell", "Scituate", "Pembroke", "Rockland", "Marshfield"],
    faqs: [
      { q: "What is Indian Head River in Hanover?", a: "The Indian Head River flows through Hanover and Pembroke, offering beautiful scenery and wildlife. The river corridor is conservation land and a popular spot for kayaking and wildlife viewing." },
      { q: "What renovations are popular in Hanover?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Hanover's Colonials, Capes, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Hanover?", a: "Yes — we serve all of Hanover including Hanover Center, Four Corners, and all surrounding residential neighborhoods." },
      { q: "What permits are required in Hanover?", a: "Hanover requires building permits from the Building Department. We handle all permitting as part of our project management service." },
      { q: "How do I get a free estimate in Hanover?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560184897-502a475f7a0d?w=1200&q=80"
  },
  hingham: {
    name: "Hingham", county: "Plymouth County", state: "MA", zip: "02043",
    region: "South Shore",
    desc: "Hingham is one of the South Shore's most desirable communities — a beautiful harbor town with the historic Old Ship Church, Derby Street Shoppes, and stunning coastal estates.",
    history: "Incorporated in 1635, Hingham is one of the oldest towns in America. The Old Ship Church (1681) is the oldest wooden church in continuous use in the United States. Hingham Harbor is a picturesque New England boating community. Hingham's affluent neighborhoods feature stunning Colonials, Capes, and coastal estates that demand premium craftsmanship.",
    landmark: "Old Ship Church (1681) & Hingham Harbor",
    services: BASE_SERVICES,
    nearbyTowns: ["Cohasset", "Norwell", "Weymouth", "Hull", "Scituate"],
    faqs: [
      { q: "What is the Old Ship Church in Hingham?", a: "The Old Ship Church (1681) is the oldest wooden church in continuous use in the United States. It's a National Historic Landmark and one of the most significant colonial-era buildings in New England." },
      { q: "What renovations are popular in Hingham?", a: "Luxury home additions, premium kitchen and bath remodels, custom carpentry, and high-end outdoor living spaces are most popular in Hingham's prestigious neighborhoods." },
      { q: "What types of homes does Coen Construction work on in Hingham?", a: "Hingham has stunning Colonials, Greek Revivals, and coastal estates on beautiful lots. We deliver the premium craftsmanship Hingham homeowners expect." },
      { q: "Does Coen Construction serve all of Hingham?", a: "Yes — we serve all of Hingham including Hingham Center, South Hingham, North Hingham, Crow Point, and all surrounding neighborhoods." },
      { q: "What permits are required in Hingham?", a: "Hingham requires building permits from the Building Department. Historic district properties may need additional review. We handle all permitting." }
    ],
    img: "https://images.unsplash.com/photo-1568010434929-06e7c8d8bcfe?w=1200&q=80"
  },
  cohasset: {
    name: "Cohasset", county: "Norfolk County", state: "MA", zip: "02025",
    region: "South Shore",
    desc: "Cohasset is one of New England's most beautiful coastal towns — a rocky, picturesque harbor community with stunning estates, excellent sailing, and the iconic Minot's Ledge Lighthouse.",
    history: "Incorporated in 1770, Cohasset is known for its dramatic rocky coastline, beautiful harbor, and some of the most exclusive real estate on the South Shore. The Minot's Ledge Lighthouse (1850) stands off Cohasset's coast and is one of the most photographed lighthouses in New England. Cohasset's stunning estates and coastal Colonials demand the finest craftsmanship.",
    landmark: "Minot's Ledge Lighthouse & Cohasset Harbor",
    services: BASE_SERVICES,
    nearbyTowns: ["Scituate", "Hingham", "Norwell", "Hull", "Marshfield"],
    faqs: [
      { q: "What is Minot's Ledge Lighthouse?", a: "Minot's Ledge Lighthouse (1850) stands on a ledge off Cohasset's rocky coast. It's one of New England's most photographed lighthouses and a beloved symbol of Cohasset's maritime heritage." },
      { q: "What makes Cohasset homes unique?", a: "Cohasset has some of the most spectacular coastal estates on the South Shore — many with direct ocean access, harbor views, and premium finishes throughout. These properties demand the finest renovation craftsmanship." },
      { q: "What renovations are popular in Cohasset?", a: "Luxury home additions, premium custom carpentry, high-end kitchen and bath remodels, and stunning coastal outdoor living spaces are most popular in Cohasset." },
      { q: "What siding is best for Cohasset's coastal location?", a: "James Hardie fiber cement siding is our strong recommendation for Cohasset's exposed coastal environment — it withstands salt air, wind, and moisture far better than any other material." },
      { q: "Does Coen Construction serve all of Cohasset?", a: "Yes — we serve all of Cohasset including the harbor area, Jerusalem Road, and all surrounding residential neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  scituate: {
    name: "Scituate", county: "Plymouth County", state: "MA", zip: "02066",
    region: "South Shore",
    desc: "Scituate is a beautiful coastal town on the South Shore known for its iconic Scituate Lighthouse, North River, and charming harbor village with excellent boating.",
    history: "Incorporated in 1636, Scituate is famous for its Scituate Lighthouse (1811), built to guide ships through the treacherous Third Cliff area. The town's North River was historically important for shipbuilding. Scituate's coastal neighborhoods feature beautiful Capes, Colonials, and waterfront estates that benefit from our premium exterior renovation services.",
    landmark: "Scituate Lighthouse (1811) & North River",
    services: BASE_SERVICES,
    nearbyTowns: ["Cohasset", "Marshfield", "Norwell", "Hingham", "Hanover"],
    faqs: [
      { q: "What is the Scituate Lighthouse?", a: "The Scituate Lighthouse (1811) is a historic lighthouse on Cedar Point guarding Scituate Harbor. It's famous in local history for the 'Army of Two' story of Rebecca and Abigail Bates who scared off British soldiers with a fife and drum in 1814." },
      { q: "What siding is best for Scituate's coastal homes?", a: "James Hardie fiber cement siding is our top recommendation for Scituate's exposed coastal environment — it withstands salt air, wind-driven rain, and freeze-thaw cycles." },
      { q: "What renovations are popular in Scituate?", a: "Coastal deck and porch additions, siding replacements, home additions, and kitchen remodels are popular in Scituate's beautiful Capes, Colonials, and waterfront estates." },
      { q: "Can you build a waterfront deck in Scituate?", a: "Yes — waterfront deck and outdoor living additions are among our most popular Scituate projects. Coastal conservation requirements apply and we navigate these carefully." },
      { q: "Does Coen Construction serve all of Scituate?", a: "Yes — we serve all of Scituate including Scituate Harbor, Humarock, Egypt, Greenbush, and all surrounding neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80"
  },
  norwell: {
    name: "Norwell", county: "Plymouth County", state: "MA", zip: "02061",
    region: "South Shore",
    desc: "Norwell is a beautiful, rural South Shore community along the North River known for its conservation land, the James Library, and a peaceful, small-town character.",
    history: "Incorporated in 1888 from South Scituate, Norwell has preserved its rural character exceptionally well. The North River, shared with Marshfield and Scituate, was historically one of New England's most important shipbuilding rivers. Norwell's James Library (1878) is one of the oldest operating public libraries in Massachusetts. The town's Capes, Colonials, and contemporaries on generous lots are ideal renovation candidates.",
    landmark: "James Library (1878) & North River Corridor",
    services: BASE_SERVICES,
    nearbyTowns: ["Scituate", "Hanover", "Marshfield", "Pembroke", "Hingham"],
    faqs: [
      { q: "What is the James Library in Norwell?", a: "The James Library & Center for the Arts (1878) is one of the oldest operating public libraries in Massachusetts, a beloved community institution in Norwell." },
      { q: "What renovations are popular in Norwell?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Norwell's Capes, Colonials, and larger-lot contemporaries." },
      { q: "Does Coen Construction serve all of Norwell?", a: "Yes — we serve all of Norwell including Norwell Center, Assinippi, Four Corners, and all surrounding residential neighborhoods." },
      { q: "Can you build near the North River in Norwell?", a: "Yes — we design and build decks and additions throughout Norwell. Conservation and wetlands requirements near the North River apply and we navigate these carefully." },
      { q: "How do I get a free estimate in Norwell?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80"
  },
  marshfield: {
    name: "Marshfield", county: "Plymouth County", state: "MA", zip: "02050",
    region: "South Shore",
    desc: "Marshfield is a beautiful coastal South Shore town famous for Daniel Webster's historic estate, several barrier beach communities, and the Green Harbor waterfront.",
    history: "Incorporated in 1640, Marshfield is famous as the home of statesman Daniel Webster, who lived at his estate here from 1832 until his death in 1852. Green Harbor, Brant Rock, and Ocean Bluff are beloved beachfront communities. Marshfield's coastal Capes, Colonials, and waterfront cottages require specialized knowledge for renovation in the coastal environment.",
    landmark: "Daniel Webster Estate & Green Harbor Beach",
    services: BASE_SERVICES,
    nearbyTowns: ["Duxbury", "Scituate", "Norwell", "Pembroke", "Kingston"],
    faqs: [
      { q: "Who was Daniel Webster and why is he associated with Marshfield?", a: "Daniel Webster was one of the most famous American statesmen of the 19th century — a legendary orator, senator, and Secretary of State. He loved Marshfield and lived at his estate 'Marshfield Farm' from 1832 until his death in 1852." },
      { q: "What siding is best for Marshfield's coastal homes?", a: "James Hardie fiber cement siding is our top choice for Marshfield's exposed coastal areas — it withstands salt air, storm surges, and freeze-thaw cycles far better than wood or vinyl." },
      { q: "What renovations are popular in Marshfield?", a: "Coastal deck and porch additions, siding replacements, home additions, and kitchen remodels are very popular in Marshfield, particularly for the beachfront cottage communities." },
      { q: "Does Coen Construction serve all of Marshfield?", a: "Yes — we serve all of Marshfield including Marshfield Hills, Green Harbor, Brant Rock, Ocean Bluff, Humarock, and all surrounding neighborhoods." },
      { q: "Can you renovate a beachfront cottage in Marshfield?", a: "Yes — we have extensive experience renovating coastal properties in Marshfield. We work within FEMA flood zone requirements and coastal conservation regulations." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  duxbury: {
    name: "Duxbury", county: "Plymouth County", state: "MA", zip: "02332",
    region: "South Shore",
    desc: "Duxbury is one of the South Shore's most prestigious coastal communities — a maritime heritage town with the Myles Standish Monument, world-class sailing, and stunning waterfront estates.",
    history: "Incorporated in 1637, Duxbury was home to Myles Standish and John Alden of Pilgrim fame. The Myles Standish Monument (1898) overlooks Plymouth Bay. Duxbury has long been considered one of New England's finest sailing communities, and its beautiful Colonials, Capes, and coastal estates on generous lots require the finest renovation craftsmanship.",
    landmark: "Myles Standish Monument & Duxbury Bay",
    services: BASE_SERVICES,
    nearbyTowns: ["Plymouth", "Marshfield", "Kingston", "Pembroke", "Hanover"],
    faqs: [
      { q: "What is the Myles Standish Monument in Duxbury?", a: "The Myles Standish Monument (1898) is a 116-foot granite tower on Captain's Hill in Duxbury overlooking Plymouth Bay. It honors Myles Standish, the Pilgrim military leader who settled in Duxbury after the Plymouth Colony." },
      { q: "Why is Duxbury famous for sailing?", a: "Duxbury Bay's sheltered waters and consistent winds have made it one of New England's premier sailing destinations for over a century. The Duxbury Bay Maritime School is nationally recognized." },
      { q: "What renovations are popular in Duxbury?", a: "Luxury waterfront additions, premium custom carpentry, high-end kitchen and bath remodels, and stunning coastal outdoor living spaces are most popular in Duxbury." },
      { q: "What siding is best for Duxbury coastal properties?", a: "James Hardie fiber cement siding is our strong recommendation for Duxbury's exposed coastal environment — it withstands salt air, storm exposure, and freeze-thaw cycles." },
      { q: "Does Coen Construction serve all of Duxbury?", a: "Yes — we serve all of Duxbury including Duxbury Beach, Powder Point, South Duxbury, and all surrounding residential neighborhoods." }
    ],
    img: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80"
  },
  pembroke: {
    name: "Pembroke", county: "Plymouth County", state: "MA", zip: "02359",
    region: "South Shore",
    desc: "Pembroke is a growing South Shore community along the Indian Head River, known for its beautiful natural setting, Silver Lake, and family-friendly neighborhoods.",
    history: "Incorporated in 1712, Pembroke was historically known for iron manufacturing and shipbuilding on the Indian Head River. Silver Lake and Center Pond provide beautiful recreation opportunities. Pembroke's growing residential community features a mix of older Colonials, Capes, and newer subdivisions along Route 53.",
    landmark: "Silver Lake & Indian Head River",
    services: BASE_SERVICES,
    nearbyTowns: ["Hanover", "Norwell", "Duxbury", "Kingston", "Rockland"],
    faqs: [
      { q: "What is Silver Lake in Pembroke?", a: "Silver Lake is a beautiful natural lake in Pembroke offering swimming, boating, and fishing. It's one of the most popular recreation destinations for Pembroke and surrounding South Shore communities." },
      { q: "What renovations are popular in Pembroke?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Pembroke's Colonials, Capes, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Pembroke?", a: "Yes — we serve all of Pembroke including Pembroke Center, Bryantville, and all surrounding residential neighborhoods." },
      { q: "Can you build near Silver Lake in Pembroke?", a: "Yes — we design and build decks and additions throughout Pembroke. Conservation and wetlands setback requirements near Silver Lake apply and we navigate these carefully." },
      { q: "How do I get a free estimate in Pembroke?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80"
  },
  kingston: {
    name: "Kingston", county: "Plymouth County", state: "MA", zip: "02364",
    region: "South Shore",
    desc: "Kingston is a charming South Shore coastal town on Kingston Bay, home to the Jones River and a growing residential community with excellent highway access.",
    history: "Incorporated in 1726, Kingston was historically a major shipbuilding center on the Jones River. Jones River Landing is now a beautiful heritage site. Kingston Bay provides beautiful waterfront access and the town has grown significantly with residential development along Route 3 and the commuter rail corridor.",
    landmark: "Jones River Landing & Kingston Bay",
    services: BASE_SERVICES,
    nearbyTowns: ["Plymouth", "Duxbury", "Pembroke", "Plympton", "Halifax"],
    faqs: [
      { q: "What is Jones River Landing in Kingston?", a: "Jones River Landing is a historic heritage site in Kingston marking the location of a major 19th-century shipbuilding operation on the Jones River. It's now a scenic park and educational destination." },
      { q: "What renovations are popular in Kingston?", a: "Home additions, kitchen remodels, deck construction, and siding replacements are popular in Kingston's Capes, Colonials, and newer subdivisions." },
      { q: "Does Coen Construction serve all of Kingston?", a: "Yes — we serve all of Kingston including Kingston Center, Rocky Nook, Whites Landing, and all surrounding residential neighborhoods." },
      { q: "Can you build near Kingston Bay?", a: "Yes — we design and build coastal decks and additions throughout Kingston. Conservation and coastal setback requirements apply and we navigate these carefully." },
      { q: "How do I get a free estimate in Kingston?", a: "Call (617) 857-COEN or use our online form. We respond within 1 business day." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  },
  hull: {
    name: "Hull", county: "Plymouth County", state: "MA", zip: "02045",
    region: "South Shore",
    desc: "Hull is a unique peninsula community in Boston Harbor known for Nantasket Beach — one of New England's finest ocean beaches — and stunning ocean views from Allerton Hill.",
    history: "Incorporated in 1644, Hull occupies a narrow peninsula jutting into Boston Harbor. Nantasket Beach has been a popular resort destination since the 1870s, accessible by ferryboat from Boston. Hull's dramatic coastal location — ocean on three sides — creates unique renovation challenges and opportunities. The historic Paragon Park carousel is one of the town's beloved landmarks.",
    landmark: "Nantasket Beach & Fort Revere",
    services: ["Home Additions", "Siding", "Decks & Pergolas", "Kitchen Remodeling", "Custom Carpentry"],
    nearbyTowns: ["Hingham", "Cohasset", "Scituate", "Weymouth"],
    faqs: [
      { q: "What is Nantasket Beach in Hull?", a: "Nantasket Beach is a 4.5-mile barrier beach in Hull — one of New England's finest ocean beaches. It's been a popular resort destination since the 1870s, easily accessible by ferry from downtown Boston." },
      { q: "What siding is essential for Hull's exposed coastal location?", a: "Hull's exposure to ocean winds and salt air demands James Hardie fiber cement siding — the only material we recommend for Hull's most exposed locations. It dramatically outperforms wood and vinyl in coastal conditions." },
      { q: "What renovations are popular in Hull?", a: "Coastal-resistant siding replacements, deck additions with ocean views, and home additions are very popular in Hull. Every Hull renovation must account for the town's extreme coastal exposure." },
      { q: "Does Coen Construction serve all of Hull?", a: "Yes — we serve all of Hull including Nantasket Beach, Allerton, Kenberma, Point Allerton, and all surrounding residential areas." },
      { q: "What permits are required in Hull?", a: "Hull requires building permits from the Building Department. Coastal development also requires careful review of FEMA flood zone requirements and state Wetlands Protection Act compliance. We navigate all requirements on your behalf." }
    ],
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80"
  }
};

// Geo coordinates & points of interest per town
const TOWN_GEO = {
  cambridge: { gps_lat: 42.3736, gps_lng: -71.1097, local_usp: "Cambridge's historic homes demand specialized expertise. We've mastered working with the city's historic commission guidelines while delivering stunning modern renovations.", pointsOfInterest: [
    { name: "Harvard University", gps_lat: 42.3744, gps_lng: -71.1169, description: "World's most prestigious university — the heart of Cambridge." },
    { name: "MIT", gps_lat: 42.3601, gps_lng: -71.0942, description: "Massachusetts Institute of Technology — iconic research hub." }
  ]},
  somerville: { gps_lat: 42.3880, gps_lng: -71.1031, local_usp: "Somerville's dense triple-decker neighborhoods are our specialty. We know exactly how to maximize your property's value with smart additions and renovations.", pointsOfInterest: [
    { name: "Davis Square", gps_lat: 42.3964, gps_lng: -71.1222, description: "Vibrant neighborhood hub with shops, restaurants & nightlife." },
    { name: "Union Square", gps_lat: 42.3792, gps_lng: -71.0946, description: "Somerville's arts and innovation district." }
  ]},
  brookline: { gps_lat: 42.3318, gps_lng: -71.1212, local_usp: "Brookline's historic preservation rules require expert navigation. We've completed dozens of approved renovations in Brookline's historic districts.", pointsOfInterest: [
    { name: "Coolidge Corner", gps_lat: 42.3396, gps_lng: -71.1213, description: "Brookline's beloved neighborhood center with boutique shops." },
    { name: "JFK Birthplace", gps_lat: 42.3357, gps_lng: -71.1270, description: "83 Beals Street — birthplace of President John F. Kennedy." }
  ]},
  medford: { gps_lat: 42.4184, gps_lng: -71.1062, local_usp: "From Tufts University area Victorians to Mystic River Colonials, Coen Construction has transformed hundreds of Medford homes with lasting craftsmanship.", pointsOfInterest: [
    { name: "Tufts University", gps_lat: 42.4085, gps_lng: -71.1190, description: "Renowned research university in the heart of Medford." },
    { name: "Mystic River", gps_lat: 42.4063, gps_lng: -71.0766, description: "Beautiful river park running through Medford." }
  ]},
  revere: { gps_lat: 42.4084, gps_lng: -71.0120, local_usp: "Revere's coastal location demands marine-grade materials and expertise. Our James Hardie installations stand up to salt air and harsh New England winters.", pointsOfInterest: [
    { name: "Revere Beach", gps_lat: 42.4107, gps_lng: -70.9934, description: "America's first public beach — established 1896." }
  ]},
  lexington: { gps_lat: 42.4474, gps_lng: -71.2245, local_usp: "Lexington's Colonial heritage demands meticulous attention to architectural detail. We design additions that look like they've always been part of your historic home.", pointsOfInterest: [
    { name: "Lexington Battle Green", gps_lat: 42.4491, gps_lng: -71.2320, description: "Where the first shots of the American Revolution were fired on April 19, 1775." },
    { name: "Minuteman Bikeway", gps_lat: 42.4500, gps_lng: -71.2200, description: "10-mile rail trail through Lexington's historic landscape." }
  ]},
  wellesley: { gps_lat: 42.2999, gps_lng: -71.2975, local_usp: "Wellesley homeowners expect perfection — and that's exactly what we deliver. Our team understands the town's exacting standards and historic commission requirements.", pointsOfInterest: [
    { name: "Wellesley College", gps_lat: 42.2947, gps_lng: -71.2917, description: "Prestigious Seven Sisters liberal arts college." }
  ]},
  newton: { gps_lat: 42.3370, gps_lng: -71.2092, local_usp: "Newton's 13 distinct villages each have their own character. We've worked in all of them and understand what makes each neighborhood unique.", pointsOfInterest: [
    { name: "Heartbreak Hill", gps_lat: 42.3333, gps_lng: -71.2167, description: "Famous Boston Marathon hills at miles 17–21." },
    { name: "Newton Centre", gps_lat: 42.3287, gps_lng: -71.1928, description: "Vibrant village center with shops and restaurants." }
  ]},
  concord: { gps_lat: 42.4607, gps_lng: -71.3499, local_usp: "Concord's historic character demands renovation expertise that respects the past. We specialize in additions that honor Colonial and Federal architecture.", pointsOfInterest: [
    { name: "Walden Pond", gps_lat: 42.4376, gps_lng: -71.3411, description: "Where Henry David Thoreau wrote 'Walden' — a National Historic Landmark." },
    { name: "North Bridge", gps_lat: 42.4726, gps_lng: -71.3486, description: "Site of the second battle of the American Revolution." }
  ]},
  plymouth: { gps_lat: 41.9593, gps_lng: -70.6673, local_usp: "Plymouth's coastal environment requires specialized materials and techniques. Our coastal-rated installations are built to withstand salt air and New England's harshest storms.", pointsOfInterest: [
    { name: "Plymouth Rock", gps_lat: 41.9562, gps_lng: -70.6625, description: "Legendary landing site of the Pilgrims — 1620." },
    { name: "Plimoth Patuxent", gps_lat: 41.9435, gps_lng: -70.6616, description: "Living history museum of the original Plymouth Colony." }
  ]},
  quincy: { gps_lat: 42.2529, gps_lng: -71.0023, local_usp: "Quincy's booming real estate market rewards quality renovations. We help homeowners maximize property value in one of Greater Boston's fastest-growing cities.", pointsOfInterest: [
    { name: "Adams National Historical Park", gps_lat: 42.2553, gps_lng: -71.0068, description: "Birthplace of Presidents John Adams & John Quincy Adams." },
    { name: "Wollaston Beach", gps_lat: 42.2679, gps_lng: -70.9941, description: "Beautiful waterfront beach along Quincy Bay." }
  ]},
  hingham: { gps_lat: 42.2312, gps_lng: -70.8906, local_usp: "Hingham's prestige demands premium craftsmanship. From Old Ship Church-adjacent Colonials to harbor estates, we deliver the quality Hingham homeowners expect.", pointsOfInterest: [
    { name: "Old Ship Church", gps_lat: 42.2402, gps_lng: -70.8904, description: "Oldest wooden church in continuous use in the US — built 1681." },
    { name: "Hingham Harbor", gps_lat: 42.2462, gps_lng: -70.8878, description: "Picturesque New England boating harbor." }
  ]},
  duxbury: { gps_lat: 42.0476, gps_lng: -70.6650, local_usp: "Duxbury's coastal estates demand the finest materials and craftsmanship. We're specialists in high-end coastal renovations that withstand New England's harshest conditions.", pointsOfInterest: [
    { name: "Myles Standish Monument", gps_lat: 42.0351, gps_lng: -70.6501, description: "116-foot granite monument overlooking Plymouth Bay." },
    { name: "Duxbury Bay", gps_lat: 42.0100, gps_lng: -70.6580, description: "World-class sailing destination on the South Shore." }
  ]},
  canton: { gps_lat: 42.1587, gps_lng: -71.1306, local_usp: "Canton's Blue Hills neighborhood is one of the most desirable on the South Shore. We build additions and decks that take full advantage of this stunning setting.", pointsOfInterest: [
    { name: "Blue Hills Reservation", gps_lat: 42.2143, gps_lng: -71.0985, description: "7,000-acre reservation with panoramic views of Boston Harbor." },
    { name: "Canton Viaduct", gps_lat: 42.1525, gps_lng: -71.1480, description: "Longest active stone railroad bridge in the US — built 1835." }
  ]},
  marshfield: { gps_lat: 42.0917, gps_lng: -70.7056, local_usp: "Marshfield's coastal communities need contractors who understand coastal building codes, FEMA flood zones, and marine-grade materials. That's our specialty.", pointsOfInterest: [
    { name: "Green Harbor Beach", gps_lat: 42.0853, gps_lng: -70.6541, description: "Beloved South Shore beach community." },
    { name: "Brant Rock", gps_lat: 42.0728, gps_lng: -70.6455, description: "Charming oceanside community with stunning coastal views." }
  ]},
  scituate: { gps_lat: 42.1969, gps_lng: -70.7186, local_usp: "Scituate's exposed coastal position requires marine-grade expertise. Our James Hardie installations and coastal-rated decks are built to last in Scituate's salt air environment.", pointsOfInterest: [
    { name: "Scituate Lighthouse", gps_lat: 42.2033, gps_lng: -70.7199, description: "Historic lighthouse built 1811 — home of the famous 'Army of Two.'" },
    { name: "Scituate Harbor", gps_lat: 42.1977, gps_lng: -70.7261, description: "Beautiful working harbor with restaurants and boating." }
  ]},
  cohasset: { gps_lat: 42.2570, gps_lng: -70.8037, local_usp: "Cohasset's dramatic coastline and exclusive estates demand the absolute finest craftsmanship. Every project we complete here must meet the highest coastal building standards.", pointsOfInterest: [
    { name: "Cohasset Harbor", gps_lat: 42.2466, gps_lng: -70.8002, description: "Picturesque harbor with stunning coastal scenery." }
  ]},
  foxborough: { gps_lat: 42.0645, gps_lng: -71.2464, local_usp: "Foxborough's growing residential market offers excellent renovation ROI. We help homeowners capitalize on the town's proximity to Gillette Stadium and easy highway access.", pointsOfInterest: [
    { name: "Gillette Stadium", gps_lat: 42.0909, gps_lng: -71.2643, description: "Home of the New England Patriots — capacity 65,878." }
  ]},
  framingham: { gps_lat: 42.2804, gps_lng: -71.4162, local_usp: "As Metro West's largest city, Framingham's diverse housing stock offers great renovation opportunities. Our team serves every neighborhood from Saxonville to South Framingham.", pointsOfInterest: [
    { name: "Framingham State University", gps_lat: 42.2952, gps_lng: -71.4339, description: "Historic public university founded in 1839." },
    { name: "Lake Cochituate", gps_lat: 42.3059, gps_lng: -71.3862, description: "Beautiful lake offering swimming, boating, and recreation." }
  ]},
  hopkinton: { gps_lat: 42.2255, gps_lng: -71.5228, local_usp: "Hopkinton is famous worldwide as the Boston Marathon start. We bring that same world-class standard to every home renovation we complete in this growing community.", pointsOfInterest: [
    { name: "Boston Marathon Start Line", gps_lat: 42.2295, gps_lng: -71.5229, description: "The iconic starting line of the world's oldest annual marathon." }
  ]},
  milton: { gps_lat: 42.2507, gps_lng: -71.0662, local_usp: "Milton's prestige and excellent schools make every renovation a worthwhile investment. We deliver the premium craftsmanship that Milton's distinguished homes deserve.", pointsOfInterest: [
    { name: "Blue Hills Reservation", gps_lat: 42.2143, gps_lng: -71.0985, description: "7,000-acre reservation with stunning views of Boston Harbor." },
    { name: "Milton Village", gps_lat: 42.2607, gps_lng: -71.0698, description: "Charming historic village center." }
  ]},
  hull: { gps_lat: 42.2882, gps_lng: -70.9020, local_usp: "Hull's three-sides-ocean exposure means every renovation must use marine-grade materials. We're specialists in coastal resilience — our installations are built to last.", pointsOfInterest: [
    { name: "Nantasket Beach", gps_lat: 42.2780, gps_lng: -70.8956, description: "4.5-mile barrier beach — one of New England's finest ocean beaches." },
    { name: "Fort Revere", gps_lat: 42.3022, gps_lng: -70.8857, description: "Historic fortification with panoramic harbor views." }
  ]}
};

export function getTownData(townSlug) {
  const normalizedSlug = townSlug.replace(/\s+/g, "-").toLowerCase();
  const geo = TOWN_GEO[normalizedSlug] || {};
  if (TOWN_DATA[normalizedSlug]) return { ...TOWN_DATA[normalizedSlug], ...geo };
  // Default data for unlisted towns
  const name = townSlug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const region = getRegionForTown(name);
  return {
    name, county: "Greater Boston Area", state: "MA", zip: "",
    region: region?.name || "Greater Boston",
    desc: `${name} is a vibrant community in Greater Boston where Coen Construction provides expert home addition, remodeling, siding, deck, and carpentry services.`,
    history: `${name}, Massachusetts, has a rich New England history. Like many Greater Boston communities, ${name} features beautiful period homes — Colonials, Capes, Victorians, and triple-deckers — that our team specializes in renovating and expanding with craftsmanship that honors their original character.`,
    landmark: `${name} Town Center`,
    services: BASE_SERVICES,
    nearbyTowns: ["Boston", "Cambridge", "Newton", "Brookline", "Somerville"],
    faqs: [
      { q: `Does Coen Construction serve ${name}, MA?`, a: `Yes! Coen Construction proudly serves ${name} and all surrounding Greater Boston communities. Contact us for a free estimate.` },
      { q: `What services do you offer in ${name}?`, a: `In ${name}, we offer home additions, deck and pergola construction, siding installation, kitchen remodeling, custom carpentry, and snow removal.` },
      { q: `How do I get a free estimate in ${name}?`, a: `Simply call us at (617) 857-COEN or fill out our online contact form. We respond within 1 business day.` },
      { q: `Are you licensed to work in ${name}, MA?`, a: `Yes. Coen Construction is fully licensed (MA Contractor Reg. #CS-107247) and insured in all Massachusetts municipalities including ${name}.` },
      { q: `What makes Coen Construction different from other contractors in ${name}?`, a: `We're a family-owned company founded in 2010 with a commitment to transparency, quality craftsmanship, and on-time, on-budget delivery.` }
    ],
    img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80"
  };
}