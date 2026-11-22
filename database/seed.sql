-- ============================================================================
-- SOLACE | Personalized Luxury, Nature & Adventure Experience Management System
-- Academic DBMS Seed Data (Realistic Luxury Resort Dataset - Prices in INR)
-- ============================================================================

SET NAMES utf8mb4;
USE solace_db;

-- Clear previous seed data safely in reverse dependency order
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reviews;
TRUNCATE TABLE payments;
TRUNCATE TABLE staff_assignments;
TRUNCATE TABLE resource_allocations;
TRUNCATE TABLE booking_status_history;
TRUNCATE TABLE bookings;
TRUNCATE TABLE itinerary_items;
TRUNCATE TABLE itineraries;
TRUNCATE TABLE experience_staff_requirements;
TRUNCATE TABLE experience_resources;
TRUNCATE TABLE experience_slots;
TRUNCATE TABLE experiences;
TRUNCATE TABLE maintenance_periods;
TRUNCATE TABLE resources;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE experience_categories;
TRUNCATE TABLE guest_preferences;
TRUNCATE TABLE interests;
TRUNCATE TABLE guests;
TRUNCATE TABLE staff;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE users;
TRUNCATE TABLE roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Roles
-- ----------------------------------------------------------------------------
INSERT INTO roles (role_id, name, description) VALUES
(1, 'admin', 'Resort general manager and experience administrators'),
(2, 'guest', 'Registered hotel guests staying at Solace Resort'),
(3, 'staff', 'Guides, naturalists, private chefs and resort instructors');

-- ----------------------------------------------------------------------------
-- 2. Users
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, role_id, full_name, email, phone, password_hash, is_active) VALUES
-- Admin
(1, 1, 'Resort Administrator', 'admin@solace.com', '+91 98765 00001', 'scrypt:32768:8:1$NmrZCVfCEr2je95M$811df8839c890958b6658d9a5791888311041d68e62447e373a9748e8cd43708c3dee43627acb6be0c91d8da5403e9554e7a72a0d6ce2af67e02e660101311ef', 1),

-- Staff Members
(2, 3, 'Aarav Deshmukh', 'aarav.naturalist@solace.com', '+91 98765 00011', 'scrypt:32768:8:1$L8AbF9YQ6WBWQrF9$bacd574a617854a1bde24bdfb6d1d426efd4086ef0869a126278d17bbe56a67c6e712ba5028ced02855d25e08598f8b56eca653336a8cbd454c50b31bbae4b7e', 1),
(3, 3, 'Chef Maya Kulkarni', 'maya.chef@solace.com', '+91 98765 00012', 'scrypt:32768:8:1$L8AbF9YQ6WBWQrF9$bacd574a617854a1bde24bdfb6d1d426efd4086ef0869a126278d17bbe56a67c6e712ba5028ced02855d25e08598f8b56eca653336a8cbd454c50b31bbae4b7e', 1),
(4, 3, 'Dr. Ananya Varma', 'ananya.wellness@solace.com', '+91 98765 00013', 'scrypt:32768:8:1$L8AbF9YQ6WBWQrF9$bacd574a617854a1bde24bdfb6d1d426efd4086ef0869a126278d17bbe56a67c6e712ba5028ced02855d25e08598f8b56eca653336a8cbd454c50b31bbae4b7e', 1),
(5, 3, 'Rohan D’Souza', 'rohan.adventure@solace.com', '+91 98765 00014', 'scrypt:32768:8:1$L8AbF9YQ6WBWQrF9$bacd574a617854a1bde24bdfb6d1d426efd4086ef0869a126278d17bbe56a67c6e712ba5028ced02855d25e08598f8b56eca653336a8cbd454c50b31bbae4b7e', 1),
(6, 3, 'Vikramaditya Hegde', 'vikram.culture@solace.com', '+91 98765 00015', 'scrypt:32768:8:1$L8AbF9YQ6WBWQrF9$bacd574a617854a1bde24bdfb6d1d426efd4086ef0869a126278d17bbe56a67c6e712ba5028ced02855d25e08598f8b56eca653336a8cbd454c50b31bbae4b7e', 1),

-- Guests
(7, 2, 'Priya Sharma', 'priya.sharma@example.com', '+91 98111 22334', 'scrypt:32768:8:1$MLK1xDid86V1aug2$70940a14a6f18a7978eb508fb9f94933463755c7974b7fd3dc85feab397e9d183d3ca941453beac94e8acc092984fecd4b2741814bfbc97956b3468e6cec2772', 1),
(8, 2, 'Arjun Mehta', 'arjun.mehta@example.com', '+91 98222 33445', 'scrypt:32768:8:1$MLK1xDid86V1aug2$70940a14a6f18a7978eb508fb9f94933463755c7974b7fd3dc85feab397e9d183d3ca941453beac94e8acc092984fecd4b2741814bfbc97956b3468e6cec2772', 1),
(9, 2, 'Elena Rostova', 'elena.rostova@example.com', '+91 98333 44556', 'scrypt:32768:8:1$MLK1xDid86V1aug2$70940a14a6f18a7978eb508fb9f94933463755c7974b7fd3dc85feab397e9d183d3ca941453beac94e8acc092984fecd4b2741814bfbc97956b3468e6cec2772', 1);

-- ----------------------------------------------------------------------------
-- 3. Staff Profile Records
-- ----------------------------------------------------------------------------
INSERT INTO staff (staff_id, user_id, specialization, contact_phone, bio, is_available, is_active) VALUES
(1, 2, 'Wildlife Naturalist & Ornithologist', '+91 98765 00011', 'Certified Western Ghats forest conservationist with 12 years of guiding experience.', 1, 1),
(2, 3, 'Executive Coastal Cuisine Chef', '+91 98765 00012', 'Michelin-trained culinary artisan specializing in farm-to-table coastal delicacies.', 1, 1),
(3, 4, 'Ayurvedic Physician & Yoga Master', '+91 98765 00013', 'Holds BAMS degree with 15 years expertise in sound bath therapy and classical pranayama.', 1, 1),
(4, 5, 'Whitewater Kayaking & High-Altitude Trekker', '+91 98765 00014', 'WFR certified adventure athlete leading technical kayaking, mountain biking and cliff trails.', 1, 1),
(5, 6, 'Heritage Historian & Cultural Ethnogeographer', '+91 98765 00015', 'Curator of local folklore, earthen pottery traditions and ancient tribal music circles.', 1, 1);

-- ----------------------------------------------------------------------------
-- 4. Guests Profile Records
-- ----------------------------------------------------------------------------
INSERT INTO guests (guest_id, party_size, budget, check_in_date, check_out_date, preferred_time_of_day, accessibility_notes, sustainability_priority) VALUES
(7, 2, 85000.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'evening', 'Ground floor access preferred for long walks', 'high'),
(8, 4, 60000.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'morning', 'None', 'medium'),
(9, 2, 45000.00, DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'afternoon', 'Allergic to pollen, prefers well-ventilated indoor workshops', 'high');

-- ----------------------------------------------------------------------------
-- 5. Master Interests
-- ----------------------------------------------------------------------------
INSERT INTO interests (interest_id, name, code, category_tag, icon, description) VALUES
(1, 'Luxury & Bespoke Indulgence', 'LUXURY', 'luxury', 'bi-gem', 'Fine dining, private yacht charters, premium spa retreats and butler-attended cabanas.'),
(2, 'Nature & Eco-Sanctuary', 'NATURE', 'nature', 'bi-tree', 'Guided botanical trails, nocturnal wildlife safaris, birdwatching and permaculture visits.'),
(3, 'Outdoor & Mountain Adventure', 'ADVENTURE', 'adventure', 'bi-compass', 'Trekking rugged ridge trails, kayaking secluded lagoons, mountain biking and aerial obstacles.'),
(4, 'Holistic Wellness & Mindfulness', 'WELLNESS', 'wellness', 'bi-heart-pulse', 'Sunrise waterfall yoga, Himalayan sound baths, Ayurvedic healing therapies and meditation.'),
(5, 'Local Heritage & Culinary Culture', 'CULTURE', 'culture', 'bi-palette', 'Coastal cooking masterclasses, artisan pottery studios, folk music and heritage village visits.'),
(6, 'Eco-Mobility & Low-Impact Living', 'SUSTAINABLE', 'sustainability', 'bi-recycle', 'Solar EV scenic drives, bamboo bicycle expeditions, zero-waste dining and marine conservation.');

-- ----------------------------------------------------------------------------
-- 6. Guest Preferences (Normalized Weights 1-5)
-- ----------------------------------------------------------------------------
-- Priya (Focus on Luxury 5, Wellness 5, Nature 4, Culture 3, Adventure 2, Sustainability 4)
INSERT INTO guest_preferences (guest_id, interest_id, weight) VALUES
(7, 1, 5), (7, 4, 5), (7, 2, 4), (7, 5, 3), (7, 6, 4), (7, 3, 2);

-- Arjun (Focus on Adventure 5, Nature 5, Sustainability 4, Culture 3, Luxury 2, Wellness 2)
INSERT INTO guest_preferences (guest_id, interest_id, weight) VALUES
(8, 3, 5), (8, 2, 5), (8, 6, 4), (8, 5, 3), (8, 1, 2), (8, 4, 2);

-- Elena (Focus on Culture 5, Nature 4, Sustainability 5, Wellness 4, Luxury 3, Adventure 2)
INSERT INTO guest_preferences (guest_id, interest_id, weight) VALUES
(9, 5, 5), (9, 6, 5), (9, 2, 4), (9, 4, 4), (9, 1, 3), (9, 3, 2);

-- ----------------------------------------------------------------------------
-- 7. Experience Categories
-- ----------------------------------------------------------------------------
INSERT INTO experience_categories (category_id, name, slug, description, icon, display_order) VALUES
(1, 'Luxury Services', 'luxury', 'Exclusive, ultra-premium hospitality experiences curated for discerning travelers.', 'bi-gem', 1),
(2, 'Nature & Eco-Tourism', 'nature', 'Immersive, bio-diverse explorations respecting the pristine forest ecosystem.', 'bi-tree', 2),
(3, 'Adventure Activities', 'adventure', 'High-energy outdoor exploits navigating trails, coastal surf and canopy heights.', 'bi-lightning-charge', 3),
(4, 'Wellness & Relaxation', 'wellness', 'Ancient therapeutic rituals and restorative mindfulness sessions by nature.', 'bi-flower1', 4),
(5, 'Local Culture & Cuisine', 'culture', 'Authentic interactions with indigenous artisans, spice masters and village elders.', 'bi-cup-hot', 5),
(6, 'Sustainable Living & Mobility', 'sustainability', 'Zero-emission transport, circular ecology workshops and conservation initiatives.', 'bi-shield-check', 6);

-- ----------------------------------------------------------------------------
-- 8. Suppliers (Local Artisans, Cooperatives & Green Vendors)
-- ----------------------------------------------------------------------------
INSERT INTO suppliers (supplier_id, name, contact_person, email, phone, address, supplier_type, is_local, products_services, is_active) VALUES
(1, 'Sylvan Organic Hillside Spice Estate', 'Nandini Shenoy', 'spices@sylvanestates.in', '+91 98450 11223', 'Western Ridge Road, Foothills', 'Local Farm & Producer', 1, 'Organic peppercorns, cardamom, nutmeg and farm tour logistics', 1),
(2, 'Karwar Coastal Traditional Fishermen Guild', 'Ganesh Tandel', 'guild@karwarfishermen.org', '+91 98451 22334', 'Seagull Cove, Port Jetty', 'Artisanal Fishery Collective', 1, 'Traditional catamarans, dawn catch tours, safety tenders', 1),
(3, 'Sahyadri Mountain Gear & Safety Cooperative', 'Sunil Pawar', 'gear@sahyadrimtn.com', '+91 98452 33445', 'Adventure Basecamp, Sector 4', 'Outdoor Equipment Partner', 1, 'Certified trekking poles, climbing harnesses, helmets, kayaks', 1),
(4, 'Kumbarwada Clay & Terracotta Artisan Guild', 'Devappa Kumbhar', 'pottery@kumbarwada.org', '+91 98453 44556', 'Artisans Quarter, Old Hamlet', 'Indigenous Craft Society', 1, 'Handmade terracotta pottery wheels, clay pots, firing kilns', 1),
(5, 'GreenVoyage Electric Mobility Fleet', 'Aditya Singhal', 'contact@greenvoyage.eco', '+91 98454 55667', 'Eco-Hub, Resort Tech Bay', 'Sustainable Vehicle Fleet', 0, 'Custom solar-roofed all-terrain buggies and bamboo e-bikes', 1),
(6, 'Niraamaya Botanical Ayurvedic Laboratories', 'Dr. Meera Nambiar', 'info@niraamayaayur.com', '+91 98455 66778', 'Forest Sanatorium, Valley Wing', 'Certified Wellness Provider', 1, 'Cold-pressed medicated oils, pure bronze kansa vats, herbal poultices', 1);

-- ----------------------------------------------------------------------------
-- 9. Resources (Equipment, Venues, Fleets & Gear)
-- ----------------------------------------------------------------------------
INSERT INTO resources (resource_id, supplier_id, name, resource_type, total_quantity, condition_status, is_sustainable, eco_notes) VALUES
(1, 3, 'Tandem Ocean Touring Kayaks', 'equipment', 10, 'excellent', 1, 'Made from 100% recycled marine ocean plastics.'),
(2, 3, 'CE-Certified Coastal Life Vests', 'gear', 24, 'excellent', 1, 'Biodegradable buoyant foam core with reflective solar strips.'),
(3, 5, 'Solar-Charged All-Terrain Electric Buggy', 'vehicle', 4, 'excellent', 1, 'Zero direct emissions; charged via 10kW resort solar canopy.'),
(4, 5, 'Ergonomic Bamboo Cruiser E-Bikes', 'vehicle', 16, 'good', 1, 'Sustainably farmed bamboo frame crafted with low embodied carbon.'),
(5, 6, 'Luxury Forest Spa Sanctuary Pavilion', 'venue', 2, 'excellent', 1, 'Natural teakwood open-air pavilion utilizing rain-harvested water.'),
(6, NULL, 'Cliffside Panoramic Sunset Dining Gazebo', 'venue', 1, 'excellent', 1, 'Private cliff venue with zero light pollution directional lamps.'),
(7, 2, 'Luxury 38ft Eco-Hybrid Catamaran', 'vehicle', 1, 'excellent', 1, 'Auxiliary solar electric thrusters minimizing marine sound disturbance.'),
(8, 4, 'Traditional Kick-Wheel Clay Pottery Stations', 'equipment', 8, 'excellent', 1, 'Non-electric manual artisan pottery wheels crafted from local stone.'),
(9, 3, 'Technical Trail Trekking Carbon Poles', 'gear', 20, 'excellent', 1, 'Ultra-lightweight aerospace-grade recyclable alloy.'),
(10, 6, 'Handcrafted Tibetan 7-Metal Singing Bowls', 'equipment', 6, 'excellent', 1, 'Fair-trade antique bronze alloys tuned to 432Hz grounding frequencies.');

-- ----------------------------------------------------------------------------
-- 10. Resort Experiences Catalogue (Prices in INR)
-- ----------------------------------------------------------------------------
INSERT INTO experiences (
    experience_id, category_id, supplier_id, name, slug, short_desc, full_desc, 
    pricing_type, base_price, duration_minutes, min_party_size, max_party_size, 
    capacity_per_slot, safety_instructions, age_restrictions, accessibility_info, 
    eco_impact_score, is_low_impact, image_url, is_active
) VALUES
-- Luxury Experiences
(1, 1, NULL, 'Private Sunset Dining on Secluded Cliff', 'private-sunset-cliff-dining',
 'An unforgettable multi-course candlelit feast prepared by a dedicated chef over the roaring ocean cliff.',
 'Perched high atop our western granite bluff, enjoy complete privacy under the twilight sky. Includes a chilled bottle of sparkling organic cider, handpicked coastal seafood and heirloom harvest dishes, personalized butler service, and acoustic sitar accompaniment. Designed for couples or intimate celebratory parties.',
 'per_booking', 14500.00, 150, 1, 4, 1,
 'Footwear with rubber soles recommended for the brief stone path. Windbreakers provided during sea-breeze gusts.',
 'Ages 12 and above', 'Staircase access required; accessible buggy transfer to viewing terrace available.',
 88, 1, '/static/images/experiences/sunset_cliff.svg', 1),

(2, 1, 2, 'Luxury Sunset Catamaran Champagne Cruise', 'luxury-sunset-catamaran-cruise',
 'Glide across twilight coastal waters aboard our silent-hybrid catamaran with artisanal hors d\'oeuvres.',
 'Set sail towards the open sea as the horizon melts into gold and indigo. Spot playful dolphins, enjoy artisanal canapés prepared with local coastal ingredients, and sip chilled beverages while listening to the soothing lap of gentle ocean waves.',
 'per_person', 5800.00, 120, 1, 10, 10,
 'Mandatory safety briefing on deck. USCG-approved life jackets provided. Guests prone to seasickness can request herbal ginger lozenges.',
 'Ages 6 and above', 'Ramped boarding gangway allows wheelchair accessibility.',
 92, 1, '/static/images/experiences/catamaran.svg', 1),

(3, 1, 6, 'Royal Ayurvedic Abhyanga & Shirodhara Spa Indulgence', 'royal-ayurvedic-abhyanga-spa',
 'Two-therapist rhythmic warm medicated oil massage followed by continuous herbal oil pouring over the third eye.',
 'An ancient wellness sanctuary ritual to calm the nervous system and detoxify tissues. Uses organic cold-pressed sesame oil infused with 28 restorative forest herbs. Concludes with a private steam bath infused with lemongrass and eucalyptus.',
 'per_person', 4800.00, 90, 1, 2, 2,
 'Shower recommended prior to treatment. Refrain from heavy meals 1 hour before.',
 'Ages 16 and above', 'Fully accessible single-level spa pavilion with hydraulic massage tables.',
 95, 1, '/static/images/experiences/ayurvedic_spa.svg', 1),

(4, 1, NULL, 'Bespoke Waterfront Cabana & Butler Retreat', 'bespoke-waterfront-cabana-retreat',
 'All-day reserved shaded teak cabana with daybeds, continuous fresh fruit infusions, and private butler.',
 'Escape to your private oasis nestled along the tranquil shoreline. Features plush organic linen loungers, personal Bluetooth soundscape, chilled organic coconuts, chilled towels, and a gourmet 3-course lunch served right at your sunbed.',
 'per_booking', 8500.00, 360, 1, 6, 4,
 'Sunscreen and sunglasses recommended. Dedicated beach attendant stationed nearby.',
 'All ages welcome', 'Wheelchair accessible decking and paved walkways.',
 90, 1, '/static/images/experiences/cabana.svg', 1),

-- Nature & Eco-Tourism Experiences
(5, 2, NULL, 'Guided Dawn Rainforest Birdwatching & Canopy Trail', 'dawn-birdwatching-canopy-trail',
 'Spot rare endemic Western Ghats avian species with our resident ornithologist in early morning mist.',
 'Traverse the pristine mist-laden biosphere reserve as the forest awakes. Learn to distinguish calls of the Malabar Pied Hornbill, Emerald Dove, and Ceylon Frogmouth. High-power optical spotting scopes and Zeiss binoculars provided.',
 'per_person', 1800.00, 150, 1, 8, 8,
 'Quiet movement required. Wear muted earth-toned clothing. Leeches socks provided during monsoon season.',
 'Ages 8 and above', 'Moderate walking on earthen forest trails with slight inclines.',
 98, 1, '/static/images/experiences/birdwatching.svg', 1),

(6, 2, 3, 'Mangrove Estuary Kayaking & Bio-Diversity Tour', 'mangrove-estuary-kayaking',
 'Paddle through silent winding mangrove channels observing fiddler crabs, mudskippers, and otters.',
 'An intimate low-impact aquatic exploration led by a marine biologist. We navigate calm tidal channels to understand the crucial role mangroves play as carbon sinks and coastal nurseries. Highly educational and tranquil.',
 'per_person', 2400.00, 120, 1, 10, 10,
 'Mandatory life vests must be fastened at all times. Basic swimming comfort advised though not strictly mandatory.',
 'Ages 10 and above', 'Participants must be able to sit upright in a kayak with back support.',
 97, 1, '/static/images/experiences/mangrove_kayak.svg', 1),

(7, 2, 1, 'Organic Permaculture Spice Farm Harvesting & Tasting', 'permaculture-spice-farm-harvest',
 'Walk through regenerative spice groves, harvest fresh pods, and learn traditional soil revitalisation.',
 'Tour our partnered multi-crop organic spice plantation. Smell crushing allspice leaves, open fresh nutmeg pods, and taste organic wild forest honey. Concludes with fresh herbal tisane brewed using newly harvested lemongrass.',
 'per_person', 1400.00, 120, 1, 12, 12,
 'Closed-toe walking shoes recommended. Sun hats and eco-friendly mosquito repellent provided.',
 'All ages welcome', 'Gentle flat garden pathways accessible for prams and electric wheelchairs.',
 99, 1, '/static/images/experiences/spice_farm.svg', 1),

(8, 2, NULL, 'Nocturnal Rainforest Bio-Luminescent Trail', 'nocturnal-rainforest-trail',
 'Discover glowing Mycena fungi, fluorescent arachnids, and nocturnal tree frogs under UV light.',
 'Under the guidance of our naturalist, switch off regular torches to witness the enchanted micro-world of bioluminescent mushrooms and hidden amphibians glowing beneath specialized wavelength lights.',
 'per_person', 2100.00, 90, 1, 8, 8,
 'UV protective eyewear and flashlights provided. Stay strictly on the designated trail.',
 'Ages 10 and above', 'Uneven night paths; requires moderate balance and steady walking.',
 96, 1, '/static/images/experiences/nocturnal_trail.svg', 1),

-- Adventure Activities
(9, 3, 3, 'Summit Sunrise Ridge Trek & Bouldering Scramble', 'summit-sunrise-ridge-trek',
 'Ascend misty granite ridges in pre-dawn silence to catch the first sunbeams over the Western Ghats.',
 'An invigorating 6.5 km trek with 400m elevation gain through shola forests and steep rocky spurs. At the summit, reward your effort with steaming filter coffee and traditional ragi breakfast packs as dawn breaks across the valley.',
 'per_person', 2800.00, 180, 1, 8, 8,
 'Ankle-support trekking shoes mandatory. 1.5L personal water bladder and walking poles provided.',
 'Ages 14 to 65 with good cardiovascular fitness', 'Challenging steep ascents and natural rocky scrambles.',
 92, 1, '/static/images/experiences/sunrise_trek.svg', 1),

(10, 3, 3, 'Coastal Sea Kayaking to Secluded Hidden Caves', 'coastal-sea-kayaking-caves',
 'Navigate ocean swells and enter crystalline sea caverns only accessible by human-powered craft.',
 'A thrilling guided marine expedition for intermediate adventurers. Paddle along rugged basalt cliffs, explore tidal sea grottos with translucent waters, and snorkel over volcanic reef formations.',
 'per_person', 3200.00, 150, 1, 6, 6,
 'Swimming ability required. Helmets and hydrodynamic life vests mandatory.',
 'Ages 16 and above', 'Requires upper body stamina and water agility.',
 91, 1, '/static/images/experiences/sea_kayak.svg', 1),

(11, 3, 5, 'Pine Forest Singletrack Mountain Biking Expedition', 'pine-forest-mountain-biking',
 'Navigate berms, switchbacks, and pine-needle forest trails on high-performance bamboo e-mountain bikes.',
 'Tackle natural terrain circuits engineered with low soil-erosion designs. Experience flow trails with gentle undulations and technical rock gardens, supervised by our expert bike marshal.',
 'per_person', 2200.00, 120, 1, 8, 8,
 'MIPS-certified safety helmets, knee and elbow pads provided and mandatory.',
 'Ages 12 and above with cycling proficiency', 'Requires balance and handling confidence.',
 94, 1, '/static/images/experiences/mountain_bike.svg', 1),

-- Wellness & Relaxation
(12, 4, NULL, 'Waterfall Yoga & Breathwork (Pranayama)', 'waterfall-yoga-pranayama',
 'Awaken the body with sunrise Hatha asanas and yogic breathwork beside a gushing jungle cascade.',
 'Harness the negative ions and natural acoustic resonance of our private waterfall. Suitable for beginners to advanced practitioners. Concludes with grounding meditation on organic cork mats and fresh coconut water.',
 'per_person', 1200.00, 75, 1, 12, 12,
 'Comfortable stretchable clothing. Mats and organic cotton meditation shawls provided.',
 'All ages welcome', 'Gentle timber deck with ramp access.',
 99, 1, '/static/images/experiences/waterfall_yoga.svg', 1),

(13, 4, 6, 'Himalayan Singing Bowl Sound Bath & Vibro-Acoustics', 'himalayan-singing-bowl-sound-bath',
 'Deep vibrational relaxation as antique bronze bowls resonate through your cellular structure.',
 'Lie back comfortably in our darkened pavilion cocooned in organic weighted duvets. As our master practitioner strikes hand-hammered singing bowls, gongs, and chime bells, feel your brainwaves ease into restorative Theta states.',
 'per_person', 1800.00, 60, 1, 8, 8,
 'Wear loose, unrestrictive clothing. Avoid caffeine 2 hours prior.',
 'Ages 10 and above', 'Fully accessible; lie down on ergonomic futons or recline in zero-gravity loungers.',
 98, 1, '/static/images/experiences/sound_bath.svg', 1),

(14, 4, NULL, 'Forest Bathing (Shinrin-Yoku) & Sensory Awakening', 'forest-bathing-shinrin-yoku',
 'Japanese-inspired mindful walking reconnecting all five senses to the healing terpenes of old-growth trees.',
 'A deliberate slow walk covering less than a kilometer in two hours. You will sit quietly, touch ancient bark, listen to birdsong, breathe in antimicrobial phytoncides, and share tea brewed with forest herbs.',
 'per_person', 1500.00, 120, 1, 10, 10,
 'Turn off all electronic phones and smartwatches during the journey.',
 'Ages 8 and above', 'Very slow, relaxed pace on level shaded trails.',
 100, 1, '/static/images/experiences/forest_bathing.svg', 1),

-- Local Culture & Cuisine
(15, 5, 4, 'Ancestral Terracotta Pottery Masterclass', 'terracotta-pottery-masterclass',
 'Learn clay shaping on a traditional kick-wheel under the guidance of 4th-generation village potters.',
 'Dig your hands into natural riverbank terracotta clay. Master centering, opening the cone, and pulling graceful earthen pots, diya lamps, or tea kulhads. Your handcrafted pieces will be kiln-fired and packaged for you.',
 'per_person', 1600.00, 90, 1, 8, 8,
 'Aprons provided. Clay washes out of clothing easily with plain water.',
 'All ages welcome', 'Seated workshop suitable for guests with mobility restrictions.',
 95, 1, '/static/images/experiences/pottery.svg', 1),

(16, 5, 1, 'Coastal Culinary Heritage & Spice Masterclass', 'coastal-culinary-masterclass',
 'Cook alongside Chef Maya using stone-ground spices, cold-pressed coconut oils, and freshly harvested produce.',
 'Step into our open-air heritage kitchen. Learn to balance sour kokum, fiery Byadagi chilies, and fresh stone-ground coconut to create authentic coastal curries, neer dosas, and banana-leaf steamed delicacies.',
 'per_person', 2800.00, 150, 1, 8, 8,
 'Cotton chef aprons and recipe booklets with spice samples provided.',
 'Ages 12 and above', 'Airy, shaded kitchen with seated prep stations.',
 93, 1, '/static/images/experiences/cooking_class.svg', 1),

(17, 5, 2, 'Heritage Coastal Village Trail & Fisherman Story Circle', 'heritage-village-trail-story',
 'Stroll through a 200-year-old fishing settlement, view ancient shipwright yards, and listen to coastal lore.',
 'Discover how local communities have lived in harmony with the Arabian Sea for centuries. Visit wooden dhow building yards, inspect handmade coir fishing nets, and enjoy fresh coconut toddy pancakes at a village home.',
 'per_person', 1500.00, 120, 1, 10, 10,
 'Respectful modest clothing covering shoulders and knees when visiting community squares.',
 'All ages welcome', 'Paved village walkways with minimal steps.',
 96, 1, '/static/images/experiences/village_trail.svg', 1),

-- Sustainability & Eco-Mobility
(18, 6, 5, 'Solar EV Scenic Coastal Biosphere Discovery', 'solar-ev-scenic-coastal-drive',
 'Drive our quiet, solar-charged open-air electric buggy along scenic clifftop roads with a digital audio-guide.',
 'Experience zero-emissions freedom touring the coastal ridge, historic lighthouses, and secluded lookout pavilions. Vehicle equipped with GPS eco-trail guidance, picnic basket, and binoculars.',
 'per_booking', 3500.00, 180, 1, 4, 3,
 'Valid motor vehicle driver license required for the designated driver.',
 'All ages for passengers; drivers must be 21+', 'Step-up into vehicle; luggage/wheelchair fold space available.',
 99, 1, '/static/images/experiences/solar_ev.svg', 1),

(19, 6, 5, 'All-Day Handcrafted Bamboo Bicycle Country Tour', 'bamboo-bicycle-country-tour',
 'Explore surrounding rural hamlets and paddy fields aboard bespoke shock-absorbing bamboo bicycles.',
 'Crafted by master artisans using organic cured bamboo, these bikes offer a wonderfully smooth ride. Tour comes with self-guided GPS maps, helmets, puncture repair kit, and refillable copper water bottles.',
 'per_person', 800.00, 360, 1, 10, 10,
 'Basic cycling balance required. Stay on designated paved country roads.',
 'Ages 12 and above', 'Requires pedaling stamina.',
 100, 1, '/static/images/experiences/bamboo_bike.svg', 1);

-- ----------------------------------------------------------------------------
-- 11. Experience Resource Mappings
-- ----------------------------------------------------------------------------
INSERT INTO experience_resources (experience_id, resource_id, quantity_required, calculation_type) VALUES
-- Cliff dining requires private cliffside gazebo
(1, 6, 1, 'per_booking'),
-- Catamaran cruise requires catamaran and life vests per person
(2, 7, 1, 'per_booking'),
(2, 2, 1, 'per_person'),
-- Spa requires spa pavilion
(3, 5, 1, 'per_booking'),
-- Mangrove kayaking requires kayaks and life vests
(6, 1, 1, 'per_booking'),
(6, 2, 1, 'per_person'),
-- Sunrise ridge trek requires trekking poles
(9, 9, 1, 'per_person'),
-- Coastal sea kayaking requires kayaks and life vests
(10, 1, 1, 'per_booking'),
(10, 2, 1, 'per_person'),
-- Mountain biking requires e-bikes
(11, 4, 1, 'per_person'),
-- Sound bath requires singing bowls
(13, 10, 1, 'per_booking'),
-- Pottery class requires pottery wheels
(15, 8, 1, 'per_person'),
-- Solar EV drive requires solar vehicle
(18, 3, 1, 'per_booking'),
-- Bamboo bicycle tour requires bamboo bikes
(19, 4, 1, 'per_person');

-- ----------------------------------------------------------------------------
-- 12. Experience Staff Requirements
-- ----------------------------------------------------------------------------
INSERT INTO experience_staff_requirements (experience_id, role_needed, quantity_required) VALUES
(1, 'Private Chef & Butler', 1),
(2, 'Master Skipper & Host', 1),
(3, 'Senior Ayurvedic Therapist', 2),
(5, 'Wildlife Naturalist & Ornithologist', 1),
(6, 'Marine Biologist & Kayak Guide', 1),
(7, 'Permaculture Horticulturist', 1),
(8, 'Nocturnal Biosphere Guide', 1),
(9, 'Technical Trekking Guide', 1),
(10, 'Coastal Water Sports Guide', 1),
(11, 'Mountain Bike Marshal', 1),
(12, 'Certified Yoga Instructor', 1),
(13, 'Sound Therapy Master', 1),
(14, 'Shinrin-Yoku Guide', 1),
(15, 'Master Terracotta Artisan', 1),
(16, 'Executive Culinary Chef', 1),
(17, 'Heritage Cultural Historian', 1);

-- ----------------------------------------------------------------------------
-- 13. Experience Slots (Generates Slots for Current and Future Days)
-- ----------------------------------------------------------------------------
-- Generating slots dynamically across dates: CURDATE(), CURDATE()+1, CURDATE()+2, CURDATE()+3, CURDATE()+4
-- Using INSERT statements for each experience across morning, afternoon, evening

-- Experience 1: Cliff Dining (Evening: 18:30 - 21:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(1, CURDATE(), '18:30:00', '21:00:00', 1, 1, 'available'),
(1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '18:30:00', '21:00:00', 1, 0, 'available'),
(1, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:30:00', '21:00:00', 1, 0, 'available'),
(1, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '18:30:00', '21:00:00', 1, 0, 'available');

-- Experience 2: Catamaran Cruise (Evening: 16:30 - 18:30)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(2, CURDATE(), '16:30:00', '18:30:00', 10, 4, 'available'),
(2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:30:00', '18:30:00', 10, 2, 'available'),
(2, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '16:30:00', '18:30:00', 10, 0, 'available'),
(2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '16:30:00', '18:30:00', 10, 0, 'available');

-- Experience 3: Ayurvedic Spa (Morning 10:00 - 11:30 & Afternoon 15:00 - 16:30)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(3, CURDATE(), '10:00:00', '11:30:00', 2, 2, 'available'),
(3, CURDATE(), '15:00:00', '16:30:00', 2, 0, 'available'),
(3, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00', '11:30:00', 2, 0, 'available'),
(3, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:00:00', '16:30:00', 2, 0, 'available'),
(3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:00:00', '11:30:00', 2, 0, 'available'),
(3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '15:00:00', '16:30:00', 2, 0, 'available');

-- Experience 5: Dawn Birdwatching (Morning: 06:30 - 09:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(5, CURDATE(), '06:30:00', '09:00:00', 8, 4, 'available'),
(5, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '06:30:00', '09:00:00', 8, 2, 'available'),
(5, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '06:30:00', '09:00:00', 8, 0, 'available'),
(5, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '06:30:00', '09:00:00', 8, 0, 'available');

-- Experience 6: Mangrove Kayaking (Morning 07:30 - 09:30 & Afternoon 15:30 - 17:30)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(6, CURDATE(), '07:30:00', '09:30:00', 10, 4, 'available'),
(6, CURDATE(), '15:30:00', '17:30:00', 10, 0, 'available'),
(6, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '07:30:00', '09:30:00', 10, 0, 'available'),
(6, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:30:00', '17:30:00', 10, 0, 'available'),
(6, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '07:30:00', '09:30:00', 10, 0, 'available'),
(6, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '07:30:00', '09:30:00', 10, 0, 'available');

-- Experience 9: Summit Trek (Morning: 05:30 - 08:30)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(9, CURDATE(), '05:30:00', '08:30:00', 8, 4, 'available'),
(9, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '05:30:00', '08:30:00', 8, 0, 'available'),
(9, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '05:30:00', '08:30:00', 8, 0, 'available'),
(9, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '05:30:00', '08:30:00', 8, 0, 'available');

-- Experience 12: Waterfall Yoga (Morning: 07:00 - 08:15)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(12, CURDATE(), '07:00:00', '08:15:00', 12, 6, 'available'),
(12, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '07:00:00', '08:15:00', 12, 0, 'available'),
(12, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '07:00:00', '08:15:00', 12, 0, 'available'),
(12, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '07:00:00', '08:15:00', 12, 0, 'available');

-- Experience 13: Himalayan Sound Bath (Evening: 17:00 - 18:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(13, CURDATE(), '17:00:00', '18:00:00', 8, 2, 'available'),
(13, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '17:00:00', '18:00:00', 8, 0, 'available'),
(13, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '17:00:00', '18:00:00', 8, 0, 'available');

-- Experience 15: Terracotta Pottery (Afternoon: 14:30 - 16:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(15, CURDATE(), '14:30:00', '16:00:00', 8, 2, 'available'),
(15, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:30:00', '16:00:00', 8, 0, 'available'),
(15, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '14:30:00', '16:00:00', 8, 0, 'available');

-- Experience 16: Coastal Culinary Masterclass (Morning 10:30 - 13:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(16, CURDATE(), '10:30:00', '13:00:00', 8, 2, 'available'),
(16, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:30:00', '13:00:00', 8, 0, 'available'),
(16, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:30:00', '13:00:00', 8, 0, 'available');

-- Experience 18: Solar EV Scenic Drive (Morning 09:00 - 12:00 & Afternoon 14:00 - 17:00)
INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(18, CURDATE(), '09:00:00', '12:00:00', 3, 1, 'available'),
(18, CURDATE(), '14:00:00', '17:00:00', 3, 0, 'available'),
(18, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '09:00:00', '12:00:00', 3, 0, 'available'),
(18, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '14:00:00', '17:00:00', 3, 0, 'available');


-- Past (already delivered) sessions used by completed bookings - explicit IDs 46-50
INSERT INTO experience_slots (slot_id, experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status) VALUES
(46, 3,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:00:00', '11:30:00', 2, 0, 'completed'),
(47, 12, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '07:00:00', '08:15:00', 12, 0, 'completed'),
(48, 5,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), '06:30:00', '09:00:00', 8, 0, 'completed'),
(49, 16, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '10:30:00', '13:00:00', 8, 0, 'completed'),
(50, 2,  DATE_SUB(CURDATE(), INTERVAL 1 DAY), '16:30:00', '18:30:00', 10, 0, 'completed');

-- Two-week rolling schedule for every experience, generated with the stored procedure
-- sp_generate_slots (duplicates of the explicit slots above are skipped by uq_slot_time).
-- Note: slot capacity is counted in "capacity units" = guests for per_person experiences
-- and 1 unit per booking for per_booking (private / exclusive) experiences.
CALL sp_generate_slots(1,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '18:30:00', '21:00:00', 1,  @n);
CALL sp_generate_slots(2,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '16:30:00', '18:30:00', 10, @n);
CALL sp_generate_slots(3,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '10:00:00', '11:30:00', 2,  @n);
CALL sp_generate_slots(3,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '15:00:00', '16:30:00', 2,  @n);
CALL sp_generate_slots(4,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '09:00:00', '15:00:00', 4,  @n);
CALL sp_generate_slots(5,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '06:30:00', '09:00:00', 8,  @n);
CALL sp_generate_slots(6,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '07:30:00', '09:30:00', 10, @n);
CALL sp_generate_slots(6,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '15:30:00', '17:30:00', 10, @n);
CALL sp_generate_slots(7,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '09:30:00', '11:30:00', 12, @n);
CALL sp_generate_slots(8,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '19:30:00', '21:00:00', 8,  @n);
CALL sp_generate_slots(9,  CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '05:30:00', '08:30:00', 8,  @n);
CALL sp_generate_slots(10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '08:00:00', '10:30:00', 6,  @n);
CALL sp_generate_slots(11, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '15:00:00', '17:00:00', 8,  @n);
CALL sp_generate_slots(12, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '07:00:00', '08:15:00', 12, @n);
CALL sp_generate_slots(13, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '17:00:00', '18:00:00', 8,  @n);
CALL sp_generate_slots(14, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '08:30:00', '10:30:00', 10, @n);
CALL sp_generate_slots(15, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '14:30:00', '16:00:00', 8,  @n);
CALL sp_generate_slots(16, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '10:30:00', '13:00:00', 8,  @n);
CALL sp_generate_slots(17, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '16:00:00', '18:00:00', 10, @n);
CALL sp_generate_slots(18, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '09:00:00', '12:00:00', 3,  @n);
CALL sp_generate_slots(18, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '14:00:00', '17:00:00', 3,  @n);
CALL sp_generate_slots(19, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 13 DAY), '07:30:00', '13:30:00', 10, @n);

-- ----------------------------------------------------------------------------
-- 14. Sample Bookings (every booking references a slot of the SAME experience)
-- ----------------------------------------------------------------------------
INSERT INTO bookings (
    booking_id, booking_reference, guest_id, experience_id, slot_id,
    booking_date, party_size, unit_price, total_amount, special_requests,
    booking_status, cancellation_deadline, cancellation_reason, refund_amount
) VALUES
-- Priya Sharma: private cliff dining tonight (slot 1)
(1, 'SOL-2026-BK001', 7, 1, 1, CURDATE(), 2, 14500.00, 14500.00,
 'Vegetarian preparations for one guest; romantic anniversary setup.',
 'confirmed', DATE_SUB(CONCAT(CURDATE(), ' 18:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Arjun Mehta: summit sunrise trek today (slot 25)
(2, 'SOL-2026-BK002', 8, 9, 25, CURDATE(), 4, 2800.00, 11200.00,
 'Please provide extra trekking poles and lactose-free snacks.',
 'confirmed', DATE_SUB(CONCAT(CURDATE(), ' 05:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Priya Sharma: Ayurvedic spa yesterday (slot 46) - completed
(3, 'SOL-2026-BK003', 7, 3, 46, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 2, 4800.00, 9600.00,
 'Focus on cervical stiffness relief.',
 'completed', DATE_SUB(CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 10:00:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Elena Rostova: pottery masterclass today (slot 36)
(4, 'SOL-2026-BK004', 9, 15, 36, CURDATE(), 2, 1600.00, 3200.00,
 'Keen on making traditional chai kulhads.',
 'confirmed', DATE_SUB(CONCAT(CURDATE(), ' 14:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Arjun Mehta: mangrove kayaking this morning (slot 19)
(5, 'SOL-2026-BK005', 8, 6, 19, CURDATE(), 4, 2400.00, 9600.00,
 'First time kayakers in our party.',
 'confirmed', DATE_SUB(CONCAT(CURDATE(), ' 07:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Priya Sharma: waterfall yoga two days ago (slot 47) - completed
(6, 'SOL-2026-BK006', 7, 12, 47, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2, 1200.00, 2400.00,
 'Beginner-friendly sequence please.',
 'completed', DATE_SUB(CONCAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY), ' 07:00:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Arjun Mehta: dawn birdwatching yesterday (slot 48) - completed
(7, 'SOL-2026-BK007', 8, 5, 48, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 4, 1800.00, 7200.00,
 'Two children (10 and 12) in the party.',
 'completed', DATE_SUB(CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 06:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Elena Rostova: coastal culinary masterclass two days ago (slot 49) - completed
(8, 'SOL-2026-BK008', 9, 16, 49, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2, 2800.00, 5600.00,
 'No shellfish for one participant.',
 'completed', DATE_SUB(CONCAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY), ' 10:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Elena Rostova: sunset catamaran yesterday (slot 50) - completed, not yet reviewed
(9, 'SOL-2026-BK009', 9, 2, 50, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 2, 5800.00, 11600.00,
 'Celebrating a birthday on board.',
 'completed', DATE_SUB(CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 16:30:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Elena Rostova: sound bath tomorrow (slot 34) - still cancellable
(10, 'SOL-2026-BK010', 9, 13, 34, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 2, 1800.00, 3600.00,
 'Prefers zero-gravity loungers.',
 'confirmed', DATE_SUB(CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 17:00:00'), INTERVAL 12 HOUR), NULL, 0.00),
-- Arjun Mehta: solar EV drive tomorrow (slot 44) - cancelled with full refund
(11, 'SOL-2026-BK011', 8, 18, 44, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 3, 3500.00, 3500.00,
 'Child seat required.',
 'cancelled', DATE_SUB(CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 09:00:00'), INTERVAL 12 HOUR),
 'Change of plans - switched to the mountain biking expedition.', 3500.00);

-- Priya Sharma: forest bathing in two days (slot generated by sp_generate_slots)
INSERT INTO bookings (
    booking_id, booking_reference, guest_id, experience_id, slot_id,
    booking_date, party_size, unit_price, total_amount, special_requests,
    booking_status, cancellation_deadline, cancellation_reason, refund_amount
)
SELECT 12, 'SOL-2026-BK012', 7, 14, es.slot_id, es.slot_date, 2, 1500.00, 3000.00,
       'Quiet trail preferred.', 'confirmed',
       DATE_SUB(TIMESTAMP(es.slot_date, es.start_time), INTERVAL 12 HOUR), NULL, 0.00
FROM experience_slots es
WHERE es.experience_id = 14 AND es.slot_date = DATE_ADD(CURDATE(), INTERVAL 2 DAY) AND es.start_time = '08:30:00';

-- ----------------------------------------------------------------------------
-- 15. Resource Allocations (reserved inventory per booking & slot)
-- ----------------------------------------------------------------------------
INSERT INTO resource_allocations (allocation_id, booking_id, resource_id, slot_id, quantity_allocated, allocation_status) VALUES
(1, 1, 6, 1, 1, 'reserved'),    -- cliff dining: private gazebo (per booking)
(2, 2, 9, 25, 4, 'reserved'),   -- trek: 4 trekking poles (per person)
(3, 4, 8, 36, 2, 'reserved'),   -- pottery: 2 kick-wheels (per person)
(4, 5, 1, 19, 1, 'reserved'),   -- mangrove: 1 tandem kayak set (per booking)
(5, 5, 2, 19, 4, 'reserved'),   -- mangrove: 4 life vests (per person)
(6, 3, 5, 46, 1, 'reserved'),   -- spa: pavilion (completed session)
(7, 9, 7, 50, 1, 'reserved'),   -- catamaran (completed session)
(8, 9, 2, 50, 2, 'reserved'),   -- catamaran: 2 life vests (completed session)
(9, 10, 10, 34, 1, 'reserved'), -- sound bath: singing bowls (per booking)
(10, 11, 3, 44, 1, 'released'); -- cancelled EV drive: buggy released

-- ----------------------------------------------------------------------------
-- 16. Staff Assignments
-- ----------------------------------------------------------------------------
INSERT INTO staff_assignments (assignment_id, booking_id, staff_id, slot_id, assignment_status) VALUES
(1, 1, 2, 1, 'confirmed'),    -- Chef Maya: cliff dining
(2, 2, 4, 25, 'confirmed'),   -- Rohan: summit trek
(3, 4, 5, 36, 'confirmed'),   -- Vikramaditya: pottery
(4, 5, 1, 19, 'confirmed'),   -- Aarav: mangrove kayaking
(5, 3, 3, 46, 'completed'),   -- Dr. Ananya: spa
(6, 6, 3, 47, 'completed'),   -- Dr. Ananya: waterfall yoga
(7, 7, 1, 48, 'completed'),   -- Aarav: birdwatching
(8, 8, 2, 49, 'completed'),   -- Chef Maya: culinary masterclass
(9, 9, 4, 50, 'completed'),   -- Rohan: catamaran host
(10, 10, 3, 34, 'confirmed'), -- Dr. Ananya: sound bath
(11, 12, 1, (SELECT slot_id FROM bookings WHERE booking_id = 12), 'confirmed'); -- Aarav: forest bathing

-- ----------------------------------------------------------------------------
-- 17. Payments (Simulator Transactions)
-- ----------------------------------------------------------------------------
INSERT INTO payments (payment_id, booking_id, transaction_reference, payment_method, amount, payment_status, simulated_gateway_response) VALUES
(1, 1, 'TXN-SIM-9821038471', 'credit_card_sim', 14500.00, 'successful', '{"auth_code": "AUTH_OK_2026", "gateway": "SolaceSimPay", "risk_score": 0.01}'),
(2, 2, 'TXN-SIM-4819203841', 'upi_sim', 11200.00, 'successful', '{"vpa": "arjun@upi", "auth_code": "UPI_SUCCESS_9918"}'),
(3, 3, 'TXN-SIM-7192840192', 'resort_credit', 9600.00, 'successful', '{"folio": "RESORT-FOLIO-701", "settled": true}'),
(4, 4, 'TXN-SIM-3918274019', 'net_banking_sim', 3200.00, 'successful', '{"bank": "HDFC_SIM", "status": "VERIFIED"}'),
(5, 5, 'TXN-SIM-6629104812', 'upi_sim', 9600.00, 'successful', '{"vpa": "arjun@upi", "auth_code": "UPI_SUCCESS_4412"}'),
(6, 6, 'TXN-SIM-5510293847', 'credit_card_sim', 2400.00, 'successful', '{"auth_code": "AUTH_OK_5510", "gateway": "SolaceSimPay"}'),
(7, 7, 'TXN-SIM-8820194756', 'upi_sim', 7200.00, 'successful', '{"vpa": "arjun@upi", "auth_code": "UPI_SUCCESS_8820"}'),
(8, 8, 'TXN-SIM-2219384756', 'resort_credit', 5600.00, 'successful', '{"folio": "RESORT-FOLIO-903", "settled": true}'),
(9, 9, 'TXN-SIM-9930192837', 'credit_card_sim', 11600.00, 'successful', '{"auth_code": "AUTH_OK_9930", "gateway": "SolaceSimPay"}'),
(10, 10, 'TXN-SIM-4401928374', 'net_banking_sim', 3600.00, 'successful', '{"bank": "SBI_SIM", "status": "VERIFIED"}'),
(11, 11, 'TXN-SIM-7710293846', 'upi_sim', 3500.00, 'refunded', '{"vpa": "arjun@upi", "auth_code": "UPI_SUCCESS_7710", "refund": "FULL"}'),
(12, 12, 'TXN-SIM-1209384756', 'credit_card_sim', 3000.00, 'successful', '{"auth_code": "AUTH_OK_1209", "gateway": "SolaceSimPay"}');

-- ----------------------------------------------------------------------------
-- 18. Reviews (only for completed bookings - enforced by trg_review_before_insert)
-- ----------------------------------------------------------------------------
INSERT INTO reviews (review_id, booking_id, guest_id, experience_id, rating, review_title, review_text, is_approved) VALUES
(1, 3, 7, 3, 5, 'Absolute Bliss and Deep Rejuvenation', 'Dr. Ananya and the spa team provided the most authentic Ayurvedic treatment I have ever experienced. The warm herbal oils and synchronized strokes relieved all my travel fatigue. A sanctuary in the true sense!', 1),
(2, 6, 7, 12, 5, 'Sunrise Serenity Beside the Falls', 'Practising pranayama with the sound of the waterfall was magical. The instructor adapted every pose for us as beginners and the fresh coconut water afterwards was perfect.', 1),
(3, 7, 8, 5, 4, 'Hornbills at First Light', 'We spotted a Malabar Pied Hornbill within twenty minutes and the kids loved the spotting scopes. The trail was a little muddy, so wear proper shoes.', 1),
(4, 8, 9, 16, 5, 'A Masterclass in Coastal Flavour', 'Chef Maya explained every spice and let us grind our own masala on the stone. The kokum curry we cooked was the best meal of the trip.', 1);

-- ----------------------------------------------------------------------------
-- 19. Itineraries & Itinerary Items
-- ----------------------------------------------------------------------------
INSERT INTO itineraries (itinerary_id, guest_id, title, start_date, end_date, total_budget, estimated_cost, status) VALUES
(1, 7, 'Priya\'s 3-Day Serene Nature & Spa Getaway', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 85000.00, 0.00, 'saved');

INSERT INTO itinerary_items (item_id, itinerary_id, experience_id, slot_id, day_number, time_block, estimated_cost, notes) VALUES
(1, 1, 12, 29, 1, 'morning', 2400.00, 'Day 1 morning: Waterfall Yoga for 2 guests'),
(2, 1, 15, 36, 1, 'afternoon', 3200.00, 'Day 1 afternoon: Pottery class'),
(3, 1, 1, 1, 1, 'evening', 14500.00, 'Day 1 evening: Sunset cliff private dinner'),
(4, 1, 5, 16, 2, 'morning', 3600.00, 'Day 2 morning: Dawn birdwatching tour'),
(5, 1, 2, 6, 2, 'evening', 11600.00, 'Day 2 evening: Catamaran cruise for 2');

-- Derived value kept consistent with its items
UPDATE itineraries i
SET i.estimated_cost = (SELECT COALESCE(SUM(ii.estimated_cost), 0) FROM itinerary_items ii WHERE ii.itinerary_id = i.itinerary_id);

-- Derived slot occupancy kept consistent with the confirmed/completed bookings above
UPDATE experience_slots es
SET es.booked_capacity = (
    SELECT COALESCE(SUM(CASE WHEN e.pricing_type = 'per_person' THEN b.party_size ELSE 1 END), 0)
    FROM bookings b
    JOIN experiences e ON e.experience_id = b.experience_id
    WHERE b.slot_id = es.slot_id AND b.booking_status IN ('confirmed', 'completed')
);

-- ----------------------------------------------------------------------------
-- 20. Maintenance Periods
-- ----------------------------------------------------------------------------
INSERT INTO maintenance_periods (maintenance_id, resource_id, start_datetime, end_datetime, reason, status) VALUES
(1, 3, DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 6 DAY), 'Routine 500km battery inspection and tire realignment', 'scheduled');

-- ----------------------------------------------------------------------------
-- 21. Audit Logs
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (log_id, user_id, action_type, entity_name, entity_id, old_values, new_values, ip_address) VALUES
(1, 1, 'INITIALIZE_SYSTEM', 'system', 1, NULL, '{"status": "solace_system_ready", "version": "1.0.0"}', '127.0.0.1'),
(2, 1, 'SLOT_INVENTORY_PUBLISH', 'experience_slots', 1, NULL, '{"slots_generated": 48}', '127.0.0.1');

