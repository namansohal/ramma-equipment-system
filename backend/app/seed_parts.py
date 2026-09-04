from app.database import SessionLocal
from app.models.spare_parts import SparePart

PARTS = [
    "13/34 Sun Gear", "13/36 Sun Gear", "5052 Filter", "5052 1280 Filter Body",
    "Accelerator End", "Accelerator Knob", "Accelerator Motor", "Accelerator Motor Complete",
    "Accelerator Wire", "Adler", "Air Filter Hyundai", "Air Pressure Gun",
    "Alternator", "Alternator Down", "Anaboun Silicon",
    "Banjo Bolt 12 No", "Banjo Bolt 15 No", "Banjo Bolt 17 No",
    "Battery 21 Plate Largestar", "Battery Charger", "Battery Relay Switch",
    "Battery Terminal", "Battery Terminal Negative",
    "Belt Tension Adjustor", "Belt Tension Adjustor Old", "Belt Tensioner Adjustor Pix",
    "Black Spray", "Black Tape", "Bolt No 19", "Bolt No 30",
    "Boom Cylinder Kit", "Original Boom Cylinder Kit 081",
    "Bosch Injector Nozzle", "Breather Assy", "Breather Filter Hyundai", "Breather Filter Old",
    "Bucket Collar Main", "Bucket Cylinder Complete", "Bucket Cylinder Repair",
    "Bucket Cylinder Kit", "Original Bucket Cylinder Kit 0138", "Original Bucket Arm Kit",
    "Bucket Cylinder Shaft Eye", "Bulb",
    "Bush 70x85x70", "Bush 80x95x90",
    "Cat Grease Gun Old", "Cat Grease Gun Kit", "Chain", "China Light",
    "Clamp Big", "Clamp Box", "Clamp Small",
    "Complete Hydraulic Pump", "Conn Bearing Kit",
    "Control Valve Kit", "Coolant Abro", "Coolant Cap", "Coolant Suprem",
    "Cutting Nozzle Small", "Top Cutting Nozzle",
    "Diesel Engine Oil", "Diesel Pump Filter 15 No Banjo End",
    "Diesel Pump New", "Diesel Pump Repair", "Diesel Pump Seal Kit",
    "Diesel Tank Cap", "Diesel Tank Gauge", "Diesel Feed Pump",
    "Delivery Valve Assy", "Down Roller", "Down Plate", "Drain Plug 17 No",
    "Engine Bushing 4891178", "Engine Bushing 5303135",
    "Engine Gauge", "Engine Head Gasket", "Engine Main Bearing Kit",
    "Engine Mounting", "Engine Oil Gauge Wire", "Engine Oil Shell",
    "Engine Plug Expansion 3007635", "Engine Plug Expansion 4938189",
    "Engine Ring Clamp", "Engine Side Cover Seal", "Engine Water Pump",
    "Injector Old", "Injector", "Injector Washer",
    "Epoxy", "EPPR", "EPPR Old",
    "Fan Belt 1397", "Feed Pump New", "Feed Pump Old", "Fevi Quick",
    "Filter 1280", "Filter 19657", "Filter Big 19657",
    "Hydraulic Drain Filter 30628", "Filter 3349",
    "Filter Body", "Filter R90", "R90 Filter Body",
    "First Carrier", "Second Carrier", "Flat Bar Old",
    "Friction Plate", "Fly Wheel", "Fuse",
    "Gear Oil", "Generator Injector",
    "Goti Set Small", "Grease Adapter", "Grease Bucket",
    "H Bar", "Hour Meter",
    "Hydraulic Strainer Filter", "Hydraulic Jack",
    "Hydraulic Main Tank to Hydraulic Pump",
    "Hydraulic Pilot Filter Hyundai", "Hydraulic Pilot Filter Normal",
    "Hydraulic Pilot Pump", "Hydraulic Pipe",
    "Hydraulic Pressure Sensor", "Hydraulic Pump Coupling Bolt",
    "Hydraulic Pump Rubber Couplings", "Hydraulic Pump Piston",
    "Hydraulic Pump Piston Plate", "Hydraulic Pump Pressure Plate",
    "Hydraulic Pump Regulator", "Hydraulic Pump Rooter",
    "Hydraulic Pump Couplings", "Hydraulic Pump Small Pipe",
    "Hydraulic Pump Spring", "Hydraulic Pump Plane Plate",
    "Hydraulic Pump Swash Plate Set", "Hydraulic Pump Shaft",
    "Hydraulic Pump Valve Guide", "Hydraulic Pump Kit",
    "Hydraulic Pump Kit R210", "Regulator Repair Kit",
    "Hydraulic Pump Shaft 12/18", "Hydraulic Pump Shaft 14/18",
    "Head Gasket Complete", "Lower Head Gasket Complete",
    "Hyundai Flat Bar Set", "Hyundai Sprocket",
    "Hyundai Hyd Return Valve Filter", "Hyundai Original Light",
    "Hyundai Spool Assy Arm", "Hydraulic Oil Hyundai", "Hydraulic Oil Sinopec",
    "Key Switch Ignition Switch",
    "L Key Set", "Star L Key", "Lever Pusher", "Lever Rubber",
    "Machine Door Lock Set", "Master Key", "Master Pin",
    "MRV China", "MRV Hyundai", "MRV Old",
    "Negative Valve Hyundai", "New Turbo Big Mouth Tata",
    "Nipple", "Non Return Banjo Bolt 19 No",
    "O Ring Box New", "Old Battery", "Old Hydraulic Pump Middle Part",
    "Old Hyundai Pedal Assy", "Old Pusher Lever", "Old Turbo", "Old Turbo Incomplete",
    "ORV China", "ORV Hyundai", "ORV Old",
    "Oxygen Gauge", "Oxygen Gauge Old",
    "Peddle Pusher", "Peddle Pusher Kit",
    "Pin 70 No", "Pin 80 No", "Pin Lock",
    "Pinion 13/34", "Pinion 13/36", "Piston Ring",
    "Piston Valve Hyundai", "Popet", "Precision Measurement",
    "Pump Element",
    "Radiator Pipe Down", "Radiator Pipe Up Top Side",
    "Rambo", "Rambo Bush", "Remote Control Valve", "Relay",
    "Repaired Starter", "Ring Gear", "Ring Gear Outer Seal",
    "RPM Sensor", "RPM Switch Pressure Sensor",
    "Return Valve 17 No", "Return Valve 19 No",
    "Seal Valve", "Solenoid Coil", "Solenoid Coil Complete",
    "Spacer 70 No Small", "Spacer 80 No Big", "Spacer 80 No Medium", "Spacer 80 No Small",
    "Spoil Alternator", "Sprocket", "Sprocket Bolt",
    "Starter", "Starter Brush Holder", "Starter Coil", "Starter Gear",
    "Starter Helper Solenoid Switch", "Starter Motor", "Tata Starter Motor",
    "Stopper", "Stopper Connector", "Swash Plate",
    "Swing Device Seal 1336", "Swing Device Drum",
    "Swing Motor 2507 Seal", "Swing Motor Bearing NU 206", "Swing Motor Bearing NU 209",
    "Swing Motor Big Bearing", "Swing Motor Gauge",
    "Swing Motor Piston Handok", "Swing Motor Piston JIC",
    "Swing Motor Piston Plate JIC", "Swing Motor Rooter Handok", "Swing Motor Rooter JIC",
    "Swing Motor Seal Complete", "Swing Motor Spring JIC", "Swing Motor Steel Plate",
    "Swing Motor Pressure Plate", "Swing Spool Original",
    "Swing Pinion Bearing Big", "Swing Pinion Bearing Small",
    "Swing Motor Kit", "Swing Motor Valve Guide",
    "Yellow Boom Swing Device Sun Gear",
    "Tapet Cover Seal", "Tat Cylinder Block", "Tata Swing Motor Rooter",
    "Teeth Adapter", "Teeth Hyundai", "Teeth Lock", "Teeth Sany",
    "Thread Lock", "Thread Making Kit", "Thread Tape", "Tiger Seal",
    "Timing Side Gasket", "Timing Side Gasket Set",
    "Track Bolt", "Track Guard", "Track Link", "Track Link Pin",
    "Top Roller", "Turbo Charger Saini", "Turbo Core", "Turbo Kit",
    "TVS Key",
    "Valve Check 22 No", "Valve Check 24 No", "Valve Check 27 No",
    "Valve Exhaust", "Valve Intake",
    "Water Separator Assy", "Water Separator Assy Old",
    "Welding Rod Electrode China", "Welding Rod Electrode Yellow ESAB",
    "Arm Cylinder Repair", "Swinging Motor",
]

def seed_parts():
    db = SessionLocal()
    try:
        existing = db.query(SparePart).count()
        if existing > 0:
            print(f"- Parts already exist ({existing} found), skipping")
            return

        added = 0
        for name in PARTS:
            part = SparePart(name=name.strip())
            db.add(part)
            added += 1

        db.commit()
        print(f"✓ {added} spare parts loaded into catalog")

    finally:
        db.close()

if __name__ == "__main__":
    seed_parts()