const signals = [
  ['EngineSpeed', 'Engine crankshaft speed', 'rpm', 1, 0, 0, 9000],
  ['VehicleSpeed', 'Vehicle road speed', 'km/h', 0.01, 0, 0, 300],
  ['CoolantTemperature', 'Engine coolant temperature', 'degC', 0.1, -40, -40, 150],
  ['IntakeAirTemperature', 'Intake manifold air temperature', 'degC', 0.1, -40, -40, 150],
  ['OilTemperature', 'Engine oil temperature', 'degC', 0.1, -40, -40, 180],
  ['AmbientTemperature', 'Ambient air temperature', 'degC', 0.1, -40, -40, 85],
  ['ManifoldPressure', 'Intake manifold absolute pressure', 'kPa', 0.01, 0, 0, 300],
  ['AmbientPressure', 'Ambient absolute pressure', 'kPa', 0.01, 0, 50, 120],
  ['ThrottlePosition', 'Throttle plate opening', '%', 0.01, 0, 0, 100],
  ['AcceleratorPosition', 'Accelerator pedal position', '%', 0.01, 0, 0, 100],
  ['BatteryVoltage', 'Electrical system voltage', 'V', 0.001, 0, 0, 30],
  ['AirMassFlow', 'Intake air mass flow', 'g/s', 0.1, 0, 0, 1000],
  ['FuelRailPressure', 'Fuel rail absolute pressure', 'bar', 0.1, 0, 0, 2500],
  ['InjectionDuration', 'Fuel injection pulse duration', 'ms', 0.001, 0, 0, 20],
  ['IgnitionAdvance', 'Ignition angle before top dead center', 'deg', 0.01, 0, -30, 60],
  ['Lambda', 'Exhaust air fuel equivalence ratio', '1', 0.0001, 0, 0.5, 2],
  ['EngineTorque', 'Estimated engine output torque', 'Nm', 0.1, 0, -200, 800],
  ['RequestedTorque', 'Driver requested engine torque', 'Nm', 0.1, 0, -200, 800],
  ['BoostDutyCycle', 'Boost control actuator duty cycle', '%', 0.01, 0, 0, 100],
  ['FanDutyCycle', 'Cooling fan duty cycle', '%', 0.01, 0, 0, 100],
  ['ExhaustTemperature', 'Exhaust gas temperature', 'degC', 0.1, 0, 0, 1200],
  ['OilPressure', 'Engine oil gauge pressure', 'kPa', 0.1, 0, 0, 1000],
  ['FuelLevel', 'Fuel tank fill level', '%', 0.01, 0, 0, 100],
  ['EngineLoad', 'Normalized engine load', '%', 0.01, 0, 0, 200],
] as const;

const calibrations = [
  ['EngineSpeedLimit', 'Maximum permitted engine speed', 0],
  ['VehicleSpeedLimit', 'Maximum permitted vehicle speed', 1],
  ['CoolantFanThreshold', 'Coolant temperature fan threshold', 2],
  ['IntakeTemperatureLimit', 'Intake air temperature protection limit', 3],
  ['OilTemperatureLimit', 'Oil temperature protection limit', 4],
  ['ColdStartThreshold', 'Ambient temperature cold start threshold', 5],
  ['ManifoldPressureLimit', 'Manifold pressure protection limit', 6],
  ['AmbientPressureReference', 'Reference ambient pressure', 7],
] as const;

const address = (value: number): string => `0x${value.toString(16).toUpperCase()}`;

const conversionBlocks = signals.map(([name, description, unit, factor, offset]) => `
    /begin COMPU_METHOD ${name}_Linear "${description} conversion" LINEAR "%9.4" "${unit}"
      COEFFS_LINEAR ${factor} ${offset}
    /end COMPU_METHOD`).join('\n');

const measurementBlocks = signals.map(([name, description, , , , lower, upper], index) => `
    /begin MEASUREMENT ${name} "${description}" SWORD ${name}_Linear 1 0 ${lower} ${upper}
      ECU_ADDRESS ${address(0x100000 + index * 2)}
    /end MEASUREMENT`).join('\n');

const characteristicBlocks = calibrations.map(([name, description, signalIndex], index) => {
  const [signalName, , , , , lower, upper] = signals[signalIndex];
  return `
    /begin CHARACTERISTIC ${name} "${description}" VALUE ${address(0x200000 + index * 2)} ScalarS16 0 ${signalName}_Linear ${lower} ${upper}
    /end CHARACTERISTIC`;
}).join('\n');

const measurementReferences = signals.map(([name]) => name).join('\n        ');
const characteristicReferences = calibrations.map(([name]) => name).join('\n        ');

/** Synthetic A2L example with fictional addresses; not intended for ECU access. */
export const demoSource: string = `ASAP2_VERSION 1 71
/begin PROJECT SyntheticPowertrain "Synthetic powertrain calibration project"
  /begin HEADER "Demonstration data only"
    VERSION "1.0"
    PROJECT_NO "SYNTHETIC_DEMO"
  /end HEADER
  /begin MODULE DemoECU "Synthetic engine control module"
    /begin MOD_COMMON "Synthetic memory layout"
      BYTE_ORDER MSB_LAST
      ALIGNMENT_WORD 2
    /end MOD_COMMON

    /begin RECORD_LAYOUT ScalarS16
      FNC_VALUES 1 SWORD ROW_DIR DIRECT
    /end RECORD_LAYOUT
    /begin RECORD_LAYOUT SpeedAxisU16
      AXIS_PTS_X 1 UWORD INDEX_INCR DIRECT
    /end RECORD_LAYOUT
${conversionBlocks}
${measurementBlocks}
${characteristicBlocks}

    /begin AXIS_PTS EngineSpeedAxis "Engine speed calibration breakpoints" 0x210000 EngineSpeed SpeedAxisU16 0 EngineSpeed_Linear 16 0 9000
    /end AXIS_PTS

    /begin FUNCTION PowertrainControl "Synthetic powertrain control function"
      /begin DEF_CHARACTERISTIC
        ${characteristicReferences}
      /end DEF_CHARACTERISTIC
      /begin IN_MEASUREMENT
        ${measurementReferences}
      /end IN_MEASUREMENT
    /end FUNCTION

    /begin GROUP Powertrain "Synthetic powertrain objects"
      ROOT
      /begin REF_MEASUREMENT
        ${measurementReferences}
      /end REF_MEASUREMENT
      /begin REF_CHARACTERISTIC
        ${characteristicReferences}
        EngineSpeedAxis
      /end REF_CHARACTERISTIC
      /begin FUNCTION_LIST
        PowertrainControl
      /end FUNCTION_LIST
    /end GROUP
  /end MODULE
/end PROJECT
`;