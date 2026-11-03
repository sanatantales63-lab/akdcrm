-- ==============================================================================
-- AKD INTERIOR — OPTIONAL FICTIONAL DEVELOPMENT SEED SCRIPT
-- ==============================================================================
-- IMPORTANT:
-- Do NOT run this seed script against your production database.
-- All records below are clearly marked fictional records for development testing.
-- ==============================================================================

INSERT INTO public.clients (
  id, client_code, full_name, phone, whatsapp, email, client_type, property_type,
  property_location, full_address, project_budget, lead_source, status, date_added, notes
) VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    'AKD-CL-001',
    '[DEMO] Vikramaditya Sengupta',
    '+91 98300 11001',
    '+91 98300 11001',
    'vikram.demo@example.com',
    'Residential',
    '3BHK Duplex Apartment',
    'Inda, Kharagpur',
    'Flat 4B, Heritage Residency, OT Road, Inda, Kharagpur, WB 721305',
    1850000.00,
    'Website (akdinterior.in)',
    'Active Client',
    CURRENT_DATE - INTERVAL '45 days',
    'Fictional demo record: Full turnkey residential interior with Italian marble foyer and walnut veneer panelling.'
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    'AKD-CL-002',
    '[DEMO] Dr. Ananya Chatterjee',
    '+91 98300 22002',
    '+91 98300 22002',
    'ananya.demo@example.com',
    'Commercial',
    'Dental & Aesthetics Clinic',
    'Malancha Road, Kharagpur',
    '2nd Floor, Aurelia Plaza, Malancha Main Road, Kharagpur, WB 721301',
    1240000.00,
    'Client Referral',
    'Active Client',
    CURRENT_DATE - INTERVAL '30 days',
    'Fictional demo record: Acoustic glass partitions, sterile modular cabinetry, and warm reception lounge.'
  );
