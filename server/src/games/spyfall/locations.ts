export interface SpyfallLocation {
  name: string;
  roles: string[];
}

// Classic Spyfall location deck. Each location lists the non-spy roles
// that can be assigned there; roles are shuffled and dealt to players.
export const SPYFALL_LOCATIONS: SpyfallLocation[] = [
  {
    name: "Airport",
    roles: ["Pilot", "Flight Attendant", "Air Traffic Controller", "Security Officer", "Baggage Handler", "Customs Officer", "Tourist"],
  },
  {
    name: "Bank",
    roles: ["Teller", "Security Guard", "Manager", "Robber", "Customer", "Loan Officer", "Armored Car Driver"],
  },
  {
    name: "Beach",
    roles: ["Lifeguard", "Surfer", "Vendor", "Tourist", "Photographer", "Beach Volleyball Player"],
  },
  {
    name: "Casino",
    roles: ["Dealer", "Security Guard", "Bartender", "Gambler", "Manager", "Waitress"],
  },
  {
    name: "Cathedral",
    roles: ["Priest", "Tourist", "Choir Singer", "Bell Ringer", "Bride", "Groom"],
  },
  {
    name: "Circus Tent",
    roles: ["Acrobat", "Clown", "Ringmaster", "Animal Trainer", "Magician", "Ticket Collector"],
  },
  {
    name: "Corporate Party",
    roles: ["CEO", "Secretary", "Waiter", "Client", "Musician", "Employee of the Month"],
  },
  {
    name: "Crusader Army",
    roles: ["Knight", "Priest", "Servant", "Archer", "Squire", "Minstrel"],
  },
  {
    name: "Space Station",
    roles: ["Astronaut", "Engineer", "Scientist", "Commander", "Alien", "Doctor"],
  },
  {
    name: "Hospital",
    roles: ["Surgeon", "Nurse", "Patient", "Anesthesiologist", "Visitor", "Receptionist"],
  },
  {
    name: "Hotel",
    roles: ["Bellhop", "Manager", "Housekeeper", "Guest", "Concierge", "Doorman"],
  },
  {
    name: "Military Base",
    roles: ["General", "Soldier", "Medic", "Sniper", "Tank Driver", "Officer"],
  },
  {
    name: "Movie Studio",
    roles: ["Director", "Actor", "Cameraman", "Stunt Double", "Producer", "Sound Engineer"],
  },
  {
    name: "Ocean Liner",
    roles: ["Captain", "Bartender", "Waiter", "Musician", "Mechanic", "Passenger"],
  },
  {
    name: "Passenger Train",
    roles: ["Conductor", "Passenger", "Engineer", "Waiter", "Stowaway"],
  },
  {
    name: "Pirate Ship",
    roles: ["Captain", "First Mate", "Cook", "Cabin Boy", "Cannoneer", "Prisoner"],
  },
  {
    name: "Polar Station",
    roles: ["Scientist", "Explorer", "Doctor", "Radio Operator", "Cook", "Mechanic"],
  },
  {
    name: "Police Station",
    roles: ["Detective", "Officer", "Criminal", "Lawyer", "Receptionist", "Forensic Analyst"],
  },
  {
    name: "Restaurant",
    roles: ["Chef", "Waiter", "Customer", "Manager", "Dishwasher", "Food Critic"],
  },
  {
    name: "School",
    roles: ["Teacher", "Student", "Principal", "Janitor", "Nurse", "Coach"],
  },
  {
    name: "Supermarket",
    roles: ["Cashier", "Manager", "Customer", "Stock Clerk", "Security Guard", "Butcher"],
  },
  {
    name: "Theater",
    roles: ["Actor", "Director", "Audience Member", "Usher", "Stagehand", "Critic"],
  },
  {
    name: "University",
    roles: ["Professor", "Student", "Dean", "Janitor", "Librarian", "Research Assistant"],
  },
  {
    name: "Zoo",
    roles: ["Zookeeper", "Veterinarian", "Visitor", "Tour Guide", "Vendor", "Photographer"],
  },
];
