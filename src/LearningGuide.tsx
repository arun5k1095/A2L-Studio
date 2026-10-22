import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Database,
  FileCode2,
  Info,
  Layers3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "./learning-guide.css";

interface Chapter {
  id: string;
  title: string;
  summary: string;
  terms: string;
  content: ReactNode;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="learn-code">
      <code>{children}</code>
    </pre>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="learn-note">
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}

function Flow({ steps }: { steps: { title: string; detail: string }[] }) {
  return (
    <ol className="learn-flow">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className="learn-step-number">{index + 1}</span>
          <strong>{step.title}</strong>
          <span>{step.detail}</span>
          {index < steps.length - 1 && (
            <ChevronRight
              className="learn-flow-arrow"
              size={18}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

const annotations = [
  {
    token: "EngineSpeed",
    label: "Name",
    explanation:
      "An identifier used by other objects to refer to this measurement. Renaming it can break references in functions, groups, axis definitions, or external tools. Identical names in different modules must be resolved in the correct module.",
  },
  {
    token: '"Engine crankshaft speed"',
    label: "Description",
    explanation:
      "A human-readable description, enclosed in double quotes. It is not the identifier. Comments and quoted strings may contain text that looks like A2L keywords without creating a block.",
  },
  {
    token: "UWORD",
    label: "Data type",
    explanation:
      "An unsigned 16-bit integer: raw values from 0 to 65,535. The storage type is not the physical unit or physical range. Byte order and alignment are separate pieces of metadata.",
  },
  {
    token: "Speed_Conversion",
    label: "Conversion",
    explanation:
      "A reference to a COMPU_METHOD in the same module. That method describes how raw values relate to engineering units. NO_COMPU_METHOD is the reserved no-conversion reference; it does not resolve to a normal conversion object.",
  },
  {
    token: "1 0",
    label: "Resolution / accuracy",
    explanation:
      "Required header metadata for resolution and accuracy. These are not the scale and offset coefficients. A linear scale and offset belong in COEFFS_LINEAR inside the referenced COMPU_METHOD.",
  },
  {
    token: "0 9000",
    label: "Physical limits",
    explanation:
      "Lower and upper limits expressed in the physical domain. They do not by themselves describe the raw integer range or prove that an ECU enforces these limits.",
  },
  {
    token: "ECU_ADDRESS 0x100000",
    label: "Address",
    explanation:
      "An optional ECU address expressed here in hexadecimal. It is not a line number or a file offset. Access may also depend on address extensions, memory pages, relocation, linker output, and protocol configuration.",
  },
];

function MeasurementWalkthrough() {
  const [selected, setSelected] = useState(0);
  const token = (index: number) => (
    <button
      type="button"
      className={`learn-token ${selected === index ? "active" : ""}`}
      aria-pressed={selected === index}
      aria-label={`Explain ${annotations[index].label}`}
      onClick={() => setSelected(index)}
    >
      {annotations[index].token}
    </button>
  );
  return (
    <section
      className="learn-walkthrough"
      aria-label="Annotated measurement example"
    >
      <div className="learn-code annotated">
        <code>
          /begin MEASUREMENT {token(0)} {token(1)}
          <br />
          {"  "}
          {token(2)} {token(3)} {token(4)} {token(5)}
          <br />
          {"  "}
          {token(6)}
          <br />
          /end MEASUREMENT
        </code>
      </div>
      <div className="learn-annotation" aria-live="polite">
        <strong>{annotations[selected].label}</strong>
        <p>{annotations[selected].explanation}</p>
      </div>
    </section>
  );
}

function ConversionLab() {
  const [raw, setRaw] = useState(4000);
  const [gain, setGain] = useState(0.25);
  const [offset, setOffset] = useState(0);
  const physical = gain * raw + offset;
  const min = Math.min(0, offset);
  const max = Math.max(1, gain * 36000 + offset);
  const y = (value: number) => 135 - ((value - min) / (max - min)) * 110;
  return (
    <section className="learn-lab" aria-label="Linear conversion calculator">
      <div className="learn-lab-controls">
        <label htmlFor="learn-raw">
          Raw ECU value <output>{raw.toLocaleString("en-US")}</output>
        </label>
        <input
          id="learn-raw"
          type="range"
          min="0"
          max="36000"
          step="100"
          value={raw}
          onChange={(event) => setRaw(Number(event.target.value))}
        />
        <label htmlFor="learn-gain">
          Scale (a) <output>{gain.toFixed(2)}</output>
        </label>
        <input
          id="learn-gain"
          type="range"
          min="0.01"
          max="1"
          step="0.01"
          value={gain}
          onChange={(event) => setGain(Number(event.target.value))}
        />
        <label htmlFor="learn-offset">
          Offset (b) <output>{offset}</output>
        </label>
        <input
          id="learn-offset"
          type="range"
          min="-500"
          max="500"
          step="10"
          value={offset}
          onChange={(event) => setOffset(Number(event.target.value))}
        />
        <div className="learn-equation">
          physical = {gain.toFixed(2)} × {raw.toLocaleString("en-US")}{" "}
          {offset < 0 ? "−" : "+"} {Math.abs(offset)}
        </div>
        <output
          className="learn-physical"
          aria-label="Physical value"
          aria-live="polite"
        >
          {physical.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
          <span>rpm</span>
        </output>
      </div>
      <figure>
        <svg
          viewBox="0 0 360 175"
          role="img"
          aria-label="Linear conversion graph: raw ECU value on the horizontal axis, physical rpm on the vertical axis"
        >
          <path d="M35 20V140H335" fill="none" stroke="#a6b9ad" />
          <path
            d="M35 50H335M35 95H335M135 20V140M235 20V140"
            fill="none"
            stroke="#e0e9e3"
          />
          <line
            x1="35"
            y1={y(offset)}
            x2="335"
            y2={y(gain * 36000 + offset)}
            stroke="#176b51"
            strokeWidth="2.5"
          />
          <circle
            cx={35 + (raw / 36000) * 300}
            cy={y(physical)}
            r="5"
            fill="#376e98"
            stroke="#fff"
            strokeWidth="2"
          />
          <text x="35" y="160">
            0
          </text>
          <text x="280" y="160">
            36,000 raw
          </text>
          <text x="40" y="15">
            Physical rpm
          </text>
        </svg>
        <figcaption>
          The point follows your inputs. This example does not read or modify an
          ECU.
        </figcaption>
      </figure>
    </section>
  );
}

const glossary: [string, string][] = [
  [
    "A2L / ASAP2",
    "A text-based description of ECU measurement and calibration objects, standardized by ASAM MCD-2 MC.",
  ],
  [
    "ECU",
    "Electronic control unit: the embedded controller whose variables and calibration objects are described.",
  ],
  [
    "Measurement",
    "A described signal to observe. Its raw storage, physical interpretation, and acquisition metadata may be defined in the file.",
  ],
  [
    "Characteristic",
    "A described calibration object, such as a scalar, curve, map, or array. Its actual values usually come from memory or a separate calibration data image.",
  ],
  [
    "Physical value",
    "A value interpreted in engineering units, such as rpm, degC, bar, or percent.",
  ],
  [
    "Raw / internal value",
    "The numerical representation before physical conversion. It depends on storage type and representation.",
  ],
  [
    "Conversion method",
    "COMPU_METHOD metadata defining the relationship between internal and physical values, including units and formatting.",
  ],
  [
    "Record layout",
    "RECORD_LAYOUT describes how the parts of a calibration record are arranged in memory.",
  ],
  [
    "Axis",
    "The independent input dimension of a curve or map, such as engine speed or load.",
  ],
  [
    "Byte order",
    "The order in which the bytes of a multi-byte value are stored; commonly called endianness.",
  ],
  [
    "Alignment",
    "The byte-boundary rules that can introduce padding between record elements.",
  ],
  [
    "Address extension",
    "Additional addressing information used with an ECU address; interpretation depends on the target and protocol.",
  ],
  [
    "XCP / CCP",
    "Measurement and calibration protocols. A2L describes relevant objects and may carry protocol configuration; the file itself is not a transport protocol.",
  ],
  [
    "DAQ",
    "Data acquisition: event-driven measurement transfer, often configured through XCP metadata.",
  ],
  [
    "A2ML",
    "A meta-language describing the schema of interface-specific IF_DATA content. It is not ordinary measurement data.",
  ],
  [
    "HEX / S-record",
    "Common formats for address-based binary data images. They can contain calibration bytes that an A2L file describes.",
  ],
  [
    "Include",
    "A directive referencing another file. A complete database may require resolving an include tree with the correct search paths.",
  ],
  [
    "Module",
    "A namespace and description context inside a project. Cross-references must be interpreted in their owning context.",
  ],
];

const chapters: Chapter[] = [
  {
    id: "basics",
    title: "Start Here",
    summary: "What A2L is, what it contains, and how it relates to an ECU.",
    terms:
      "basics beginner ASAP2 ASAM MCD-2 MC hex s19 calibration binary metadata",
    content: (
      <>
        <p>
          An A2L file is a readable description of an ECU's measurement and
          calibration interface. It tells engineering tools what objects exist,
          how they are represented, where they may be located, and how to
          interpret them. A2L is commonly called <strong>ASAP2</strong>; the
          standard is <strong>ASAM MCD-2 MC</strong>.
        </p>
        <h3>Think of it as a map, not the territory</h3>
        <p>
          A label such as <code>EngineSpeed</code> becomes useful when a tool
          knows its storage type, conversion to rpm, and access information. A2L
          supplies this description. It does not by itself connect to an ECU or
          acquire a live value.
        </p>
        <Flow
          steps={[
            {
              title: "A2L description",
              detail: "Names, types, addresses, units, layouts",
            },
            {
              title: "Calibration tool",
              detail: "Interprets the description and target configuration",
            },
            {
              title: "ECU or data image",
              detail: "Provides the actual bytes and runtime values",
            },
          ]}
        />
        <h3>What belongs where?</h3>
        <div className="learn-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Artifact</th>
                <th>Typical purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>A2L</td>
                <td>Describes objects and how to interpret their data.</td>
              </tr>
              <tr>
                <td>HEX / S-record / binary</td>
                <td>
                  Contains address-based or binary program/calibration bytes.
                </td>
              </tr>
              <tr>
                <td>XCP / CCP connection</td>
                <td>
                  Can transfer measurements and calibration data with an ECU.
                </td>
              </tr>
              <tr>
                <td>Measurement recording</td>
                <td>
                  Stores acquired time-series samples, often in a format such as
                  MDF.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>
          A2L can contain numerical metadata and conversion tables, but that is
          not the same as containing the ECU's complete calibration payload.
          Editing an A2L address does not move a variable in firmware.
        </Note>
        <h3>Your first reading pass</h3>
        <ol>
          <li>Find the declared ASAP2 version and project/module names.</li>
          <li>
            Choose one measurement and inspect its type, conversion, physical
            limits, and address metadata.
          </li>
          <li>Follow its conversion reference and check the unit.</li>
          <li>
            Only then explore calibration objects, layouts, and
            protocol-specific configuration.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "structure",
    title: "File Structure",
    summary: "Blocks, keywords, comments, strings, includes, and namespaces.",
    terms:
      "PROJECT MODULE HEADER ASAP2_VERSION syntax begin end identifiers strings comments include",
    content: (
      <>
        <p>
          A2L is a keyword-based text format. Many entities are blocks delimited
          by <code>/begin KEYWORD</code> and <code>/end KEYWORD</code>. Required
          positional values usually appear first; optional keywords and nested
          blocks follow. Not every keyword creates a block.
        </p>
        <Code>{`ASAP2_VERSION 1 71
/begin PROJECT Demo "Demonstration database"
  /begin HEADER "Build description"
    VERSION "demo-1"
  /end HEADER
  /begin MODULE Powertrain "Powertrain controller"
    /* Object definitions belong here. */
  /end MODULE
/end PROJECT`}</Code>
        <Flow
          steps={[
            {
              title: "PROJECT",
              detail: "Database identity and optional header",
            },
            { title: "MODULE", detail: "A description context and namespace" },
            {
              title: "Objects",
              detail: "Measurements, characteristics, conversions, and more",
            },
          ]}
        />
        <h3>Identifiers versus descriptions</h3>
        <p>
          <code>EngineSpeed</code> is an identifier.{" "}
          <code>"Engine crankshaft speed"</code> is a description. Quoted
          strings can contain spaces; identifiers are used by references and
          must follow the applicable grammar. Treat case and punctuation as
          significant rather than casually normalizing names.
        </p>
        <h3>Whitespace, comments, and numbers</h3>
        <p>
          Line breaks and indentation usually improve readability rather than
          define a record. Block comments use <code>/* ... */</code>; line
          comments may also occur in files this reader accepts. Quoted text and
          comments must not be mistaken for real block markers. Numeric fields
          can use decimal, hexadecimal where allowed, and scientific notation
          depending on the field's grammar.
        </p>
        <h3>Includes and fragments</h3>
        <Code>{`/include "shared_conversions.a2l"`}</Code>
        <p>
          Some files are fragments rather than complete projects. Includes can
          supply shared definitions. Resolving them requires the correct files,
          search paths, and dependency handling. This workbench preserves
          includes and reports them, but does not expand them.
        </p>
        <Note>
          <code>ASAP2_VERSION 1 71</code> denotes version 1.71, not 1.7.1. The
          declaration is important context, not proof that every construct in
          the file conforms to that version.
        </Note>
      </>
    ),
  },
  {
    id: "measurements",
    title: "Measurements",
    summary: "Read a signal definition one field at a time.",
    terms:
      "MEASUREMENT datatype UBYTE UWORD SWORD FLOAT32_IEEE resolution accuracy ECU_ADDRESS limits PHYS_UNIT",
    content: (
      <>
        <p>
          A <code>MEASUREMENT</code> describes a quantity to observe: engine
          speed, a temperature, a sensor state, or a calculated value. The
          declaration describes the signal; it does not contain a live sample.
        </p>
        <h3>Annotated example</h3>
        <p>Select a highlighted token to examine its role.</p>
        <MeasurementWalkthrough />
        <h3>Storage type is not physical meaning</h3>
        <div className="learn-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Example type</th>
                <th>Storage interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>UBYTE / SBYTE</td>
                <td>Unsigned / signed 8-bit integer.</td>
              </tr>
              <tr>
                <td>UWORD / SWORD</td>
                <td>Unsigned / signed 16-bit integer.</td>
              </tr>
              <tr>
                <td>ULONG / SLONG</td>
                <td>Unsigned / signed 32-bit integer.</td>
              </tr>
              <tr>
                <td>FLOAT32_IEEE / FLOAT64_IEEE</td>
                <td>
                  IEEE floating-point representation; width and byte order still
                  matter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          A raw unsigned integer might represent temperature after a conversion
          with a negative offset. Conversely, a floating-point signal still
          needs the correct unit and interpretation. Do not infer engineering
          meaning from a name or type alone.
        </p>
        <h3>Other metadata you may encounter</h3>
        <p>
          <code>BIT_MASK</code> can identify relevant bits.{" "}
          <code>MATRIX_DIM</code> can describe dimensions. Address extensions,
          byte order, symbols, and protocol-specific acquisition settings may
          also appear. Arrays and bitfields require more than simply reading one
          scalar at an address.
        </p>
        <Note>
          A missing address is not automatically a malformed measurement. The
          applicable version, addressing method, generated symbols, and protocol
          metadata determine how the object can be accessed.
        </Note>
      </>
    ),
  },
  {
    id: "calibration",
    title: "Calibration Objects",
    summary: "Scalars, curves, maps, and axis definitions.",
    terms:
      "CHARACTERISTIC VALUE CURVE MAP VAL_BLK ASCII AXIS_PTS AXIS_DESCR COM_AXIS STD_AXIS FIX_AXIS",
    content: (
      <>
        <p>
          A <code>CHARACTERISTIC</code> describes a calibration object that an
          engineering tool can potentially tune. Whether it is writable in
          practice depends on the target, permissions, protocol, memory page,
          and tooling. Editing its description in this app does not write a
          value to an ECU.
        </p>
        <Flow
          steps={[
            {
              title: "Scalar · VALUE",
              detail: "One parameter, such as idle-speed target",
            },
            { title: "Curve · CURVE", detail: "One independent input axis" },
            { title: "Map · MAP", detail: "Two independent input axes" },
          ]}
        />
        <Code>{`/begin CHARACTERISTIC IdleSpeed_Target "Target idle speed"
  VALUE 0x200000 RL_UWORD 0 Speed_Conversion 600 1200
/end CHARACTERISTIC`}</Code>
        <p>
          After name and description, this example provides the object type,
          address, record-layout reference, maximum-difference metadata,
          conversion reference, and physical limits. The actual idle-speed value
          is not written into this declaration.
        </p>
        <h3>Understand the axes before the map</h3>
        <p>
          A curve could express fuel quantity versus engine speed. A map could
          express fuel quantity versus speed and load. Axis descriptors identify
          the input quantities, conversions, point counts, limits, and storage
          approach. The shape alone does not establish correct units,
          interpolation behavior, or physical validity.
        </p>
        <div
          className="learn-map"
          role="img"
          aria-label="Illustrative two-dimensional calibration map: columns are engine-speed breakpoints and rows are load breakpoints. Cells represent calibration values, not A2L source values."
        >
          <div>Load / Speed</div>
          <strong>1,000 rpm</strong>
          <strong>2,000 rpm</strong>
          <strong>3,000 rpm</strong>
          <strong>20%</strong>
          <span>12</span>
          <span>16</span>
          <span>19</span>
          <strong>50%</strong>
          <span>21</span>
          <span>28</span>
          <span>34</span>
          <strong>80%</strong>
          <span>32</span>
          <span>41</span>
          <span>48</span>
        </div>
        <p>
          These numbers illustrate a data grid, not a production calibration. An
          A2L usually describes how to interpret such a grid rather than
          supplying all its cells.
        </p>
        <h3>Shared and fixed axes</h3>
        <p>
          <code>AXIS_PTS</code> describes a separately addressable axis object.
          An <code>AXIS_DESCR</code> is nested inside a characteristic and
          describes a dimension. Common axes can reference shared points;
          fixed-axis forms derive points from metadata. These are distinct from
          a normal axis stored with its characteristic. Additional array, text,
          and higher-dimensional characteristic types depend on the applicable
          version.
        </p>
      </>
    ),
  },
  {
    id: "conversions",
    title: "Units & Conversions",
    summary: "Translate raw values into meaningful engineering units.",
    terms:
      "COMPU_METHOD COEFFS_LINEAR LINEAR RAT_FUNC FORM TAB_INTP TAB_NOINTP COMPU_TAB COMPU_VTAB NO_COMPU_METHOD UNIT physical raw",
    content: (
      <>
        <p>
          A <code>COMPU_METHOD</code> describes the relationship between an
          internal representation and a physical value. It can also supply
          display format and units. Measurements and characteristics normally
          refer to it by name rather than repeat the conversion definition.
        </p>
        <Code>{`/begin COMPU_METHOD Speed_Conversion "Raw counts to rpm"
  LINEAR "%8.2" "rpm"
  COEFFS_LINEAR 0.25 0
/end COMPU_METHOD`}</Code>
        <p>
          For this linear example, <strong>physical = a × raw + b</strong>. A
          raw count of 4,000 produces 1,000 rpm when a = 0.25 and b = 0. The
          display format controls presentation; it does not change the stored
          bytes.
        </p>
        <h3>Try the conversion</h3>
        <ConversionLab />
        <h3>Not every conversion is linear</h3>
        <ul>
          <li>
            <code>COMPU_TAB</code> supports numeric conversion tables; the
            method and table define whether interpolation applies.
          </li>
          <li>
            <code>COMPU_VTAB</code> maps values to text labels, useful for
            states such as Off, Ready, or Fault. Range-based text tables may
            also appear.
          </li>
          <li>
            <code>RAT_FUNC</code> and formula-based methods have defined
            conventions and directionality. Do not reuse the linear formula or
            assume a rational expression is raw-to-physical without checking the
            standard and tool implementation.
          </li>
          <li>
            <code>NO_COMPU_METHOD</code> is a special no-conversion reference,
            not an unresolved ordinary object name.
          </li>
        </ul>
        <Note>
          Conversions are metadata here. This workbench's calculator is
          educational; it is not a complete evaluator for arbitrary A2L methods
          or a live signal display.
        </Note>
      </>
    ),
  },
  {
    id: "memory",
    title: "Memory & Layouts",
    summary: "Addresses, endianness, record ordering, and alignment.",
    terms:
      "RECORD_LAYOUT FNC_VALUES ROW_DIR COLUMN_DIR BYTE_ORDER MSB_LAST MSB_FIRST alignment address ECU_ADDRESS_EXTENSION SYMBOL_LINK",
    content: (
      <>
        <p>
          An address is only one piece of the memory interpretation. Storage
          width, byte order, record layout, alignment, dimensions, and
          addressing context all affect the bytes a tool must read.
        </p>
        <h3>Byte order, illustrated</h3>
        <p>
          The same two bytes can represent different unsigned 16-bit values
          depending on their order.
        </p>
        <div className="learn-byte-order">
          <div>
            <strong>Bytes at ascending addresses</strong>
            <code>
              <span>0x34</span>
              <span>0x12</span>
            </code>
          </div>
          <div>
            <strong>Least-significant byte first</strong>
            <code>0x1234 = 4,660</code>
          </div>
          <div>
            <strong>Most-significant byte first</strong>
            <code>0x3412 = 13,330</code>
          </div>
        </div>
        <p>
          <code>MSB_LAST</code> commonly denotes little-endian byte ordering and{" "}
          <code>MSB_FIRST</code> big-endian ordering. Interpret the effective
          setting in its module/object context rather than applying a host-PC
          assumption.
        </p>
        <h3>Record layouts describe calibration records</h3>
        <Code>{`/begin RECORD_LAYOUT RL_UWORD
  FNC_VALUES 1 UWORD ROW_DIR DIRECT
/end RECORD_LAYOUT`}</Code>
        <p>
          This simple layout describes the function-value portion of a record.
          More complex layouts describe axis counts, axis points, offsets,
          reserved elements, and other record components. The position number is
          a layout ordering field, not automatically a byte offset. Row/column
          direction and addressing modes have precise meanings.
        </p>
        <Flow
          steps={[
            {
              title: "Address context",
              detail: "Address, extension, page, relocation",
            },
            {
              title: "Record layout",
              detail: "Element order, types, dimensions, alignment",
            },
            {
              title: "Byte interpretation",
              detail: "Endianness and conversion to physical units",
            },
          ]}
        />
        <Note>
          Changing an address or layout in an A2L does not rearrange firmware
          memory. A wrong description can cause an external tool to read or
          write the wrong location. Cross-check linker outputs and approved
          target documentation.
        </Note>
      </>
    ),
  },
  {
    id: "organization",
    title: "References & Organization",
    summary: "Follow functions, groups, and reusable definitions.",
    terms:
      "FUNCTION GROUP REF_MEASUREMENT REF_CHARACTERISTIC IN_MEASUREMENT OUT_MEASUREMENT DEF_CHARACTERISTIC SUB_FUNCTION TYPEDEF INSTANCE UNIT module references",
    content: (
      <>
        <p>
          Real databases contain many reusable definitions. Functions and groups
          organize objects without necessarily describing separate memory
          allocations. A single signal can participate in more than one
          organizational view.
        </p>
        <Code>{`/begin GROUP Thermal "Thermal signals"
  ROOT
  /begin REF_MEASUREMENT
    CoolantTemperature OilTemperature
  /end REF_MEASUREMENT
/end GROUP`}</Code>
        <h3>Follow a reference chain</h3>
        <Flow
          steps={[
            {
              title: "GROUP / FUNCTION",
              detail: "Find a domain or logical responsibility",
            },
            { title: "Object", detail: "Read its header and nested metadata" },
            {
              title: "Definitions",
              detail: "Resolve conversion, layout, axis, and unit references",
            },
          ]}
        />
        <p>
          A <code>FUNCTION</code> can describe inputs, outputs, locally used
          measurements, defined or referenced characteristics, and subfunctions
          through dedicated blocks. A <code>GROUP</code> provides
          browsing-oriented grouping and can contain subgroups. Their exact
          permitted contents depend on the version.
        </p>
        <h3>Reusable types and instances</h3>
        <p>
          Newer descriptions may use typedefs, structure definitions, and{" "}
          <code>INSTANCE</code> objects to avoid repeating a layout for each
          instance. These are not interchangeable with simple scalar measurement
          declarations. Types, instance addresses, and structure components must
          be interpreted together.
        </p>
        <h3>Renaming requires dependency awareness</h3>
        <p>
          Before a rename, identify references in the owning module and any
          external tooling. This workbench edits tokens but does not
          automatically rewrite dependent names. A structurally balanced file
          can still have broken references or incorrect units.
        </p>
      </>
    ),
  },
  {
    id: "interfaces",
    title: "Interfaces & Vendor Data",
    summary: "A2ML, IF_DATA, XCP/CCP, and why unknown blocks matter.",
    terms:
      "IF_DATA A2ML XCP CCP DAQ event transport CAN Ethernet vendor extension protocol",
    content: (
      <>
        <p>
          A2L covers a common description model, but interface-specific
          information often appears in <code>IF_DATA</code>. An{" "}
          <code>A2ML</code> block can describe the schema used to interpret that
          interface data. Preserving a block is different from understanding or
          validating its meaning.
        </p>
        <Flow
          steps={[
            {
              title: "A2L object",
              detail: "What the quantity or parameter is",
            },
            {
              title: "IF_DATA / A2ML",
              detail: "Interface-specific schema and settings",
            },
            {
              title: "Transport & protocol",
              detail: "How an external tool communicates with the target",
            },
          ]}
        />
        <h3>XCP is not the file format</h3>
        <p>
          XCP is a measurement and calibration protocol that can operate over
          different transports, such as CAN or Ethernet. CCP is another
          calibration protocol. A2L descriptions may carry configuration for
          such interfaces, but opening a file here establishes no connection to
          an ECU.
        </p>
        <h3>DAQ and events</h3>
        <p>
          Event channels and DAQ metadata help a capable measurement tool
          understand event-driven acquisition. The existence of a DAQ-related
          block does not prove a signal is currently available, accessible, or
          being sampled. Target capabilities and session configuration still
          matter.
        </p>
        <h3>Do not delete unfamiliar content</h3>
        <p>
          Vendor extensions can contain information needed by an approved
          toolchain even when a generic viewer cannot interpret it. Use All
          blocks or Source to inspect retained content. Do not flatten, reorder,
          or remove opaque interface data merely to eliminate a warning.
        </p>
        <Note>
          This workbench indexes and retains unknown blocks. It does not fully
          interpret arbitrary A2ML schemas, validate every IF_DATA dialect, or
          implement ECU communications.
        </Note>
      </>
    ),
  },
  {
    id: "versions",
    title: "Versions & Compatibility",
    summary: "What to check when files come from different toolchains.",
    terms:
      "ASAP2_VERSION 1.31 1.50 1.60 1.61 1.70 1.71 compatibility encoding BOM utf windows1252 include validation",
    content: (
      <>
        <p>
          A2L evolves across standard revisions. Keywords, object types,
          optional elements, and constraints can differ. A version-tolerant
          structural viewer can preserve unfamiliar content without proving that
          the content is valid for a declared revision.
        </p>
        <h3>A practical compatibility checklist</h3>
        <ul>
          <li>
            Record the declared ASAP2 version and the generating tool/version.
          </li>
          <li>
            Confirm that the database matches the ECU software build and
            calibration dataset.
          </li>
          <li>
            Resolve includes using the intended directory structure and search
            paths in an approved tool.
          </li>
          <li>
            Check encoding, BOM, line endings, and vendor conventions before
            export.
          </li>
          <li>
            Validate both syntax and semantics with a suitable ASAM/vendor
            toolchain.
          </li>
          <li>
            Reimport an exported file into the downstream tool before
            operational use.
          </li>
        </ul>
        <h3>Encoding is not the standard version</h3>
        <p>
          A BOM, Unicode text, or Windows-1252 characters describe byte
          encoding, not ASAP2 feature support. This app supports UTF-8,
          BOM-marked UTF-16LE/BE, and a Windows-1252 fallback. The fallback is a
          heuristic; visually confirm non-ASCII labels and keep the original
          file.
        </p>
        <h3>Three levels of confidence</h3>
        <Flow
          steps={[
            {
              title: "Structural",
              detail: "Tokens and block nesting can be read",
            },
            {
              title: "Semantic",
              detail: "References and version-specific rules are coherent",
            },
            {
              title: "Operational",
              detail: "The description matches the real target and toolchain",
            },
          ]}
        />
        <Note>
          The workbench reports structural diagnostics and selected warnings.
          Its generated test suite is not evidence of universal vendor
          compatibility or full ASAM conformance.
        </Note>
      </>
    ),
  },
  {
    id: "workflow",
    title: "Safe Editing Workflow",
    summary: "Explore, change, review, and export without losing context.",
    terms:
      "tutorial workflow inspector source undo redo save export diagnostics limits safety backup",
    content: (
      <>
        <ol className="learn-workflow">
          <li>
            <strong>Keep an original</strong>
            <p>
              Work from a backup tied to an identified ECU build. Never use a
              plausible-looking address from an unrelated demo or project.
            </p>
          </li>
          <li>
            <strong>Scope your search</strong>
            <p>
              Select the correct document and module, then filter by object
              type. Confirm the full identifier rather than a shortened table
              label.
            </p>
          </li>
          <li>
            <strong>Inspect before editing</strong>
            <p>
              Read the description, type, conversion, physical limits, and
              nested blocks. Follow conversion/layout references where relevant.
            </p>
          </li>
          <li>
            <strong>Make one intentional change</strong>
            <p>
              Apply supported header edits in Properties. Use Open source to
              reveal and highlight the exact block in the full file. For
              unsupported fields, edit source while retaining surrounding vendor
              content.
            </p>
          </li>
          <li>
            <strong>Check dependencies</strong>
            <p>
              Renames do not rewrite references. Address, layout, or unit
              changes need target-specific review. Undo/redo can help with local
              edits; it is not a substitute for version control or an original
              backup.
            </p>
          </li>
          <li>
            <strong>Review and export</strong>
            <p>
              Check diagnostics and compare the exported text with the original.
              Save copy preserves the detected encoding; Export UTF-8 makes a
              separate UTF-8 download. Neither operation writes to the original
              file.
            </p>
          </li>
          <li>
            <strong>Validate downstream</strong>
            <p>
              Reimport using approved tools and validate against the intended
              software/data image before connecting to or modifying a target.
            </p>
          </li>
        </ol>
        <Note>
          Tabs and edits are memory-only. Download your changes before reloading
          or leaving. A clean structural report does not establish safe ECU
          behavior, correct calibration, or valid memory access.
        </Note>
        <h3>Common mistakes to avoid</h3>
        <ul>
          <li>Confusing physical limits with raw integer limits.</li>
          <li>Treating display precision as a scaling coefficient.</li>
          <li>Assuming an address is a byte offset into a HEX text file.</li>
          <li>
            Changing a shared conversion without considering every referencing
            object.
          </li>
          <li>
            Deleting unresolved includes or vendor blocks to make diagnostics
            quieter.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "glossary",
    title: "Glossary",
    summary: "A plain-language reference for common A2L terms.",
    terms: glossary
      .map(([term, description]) => `${term} ${description}`)
      .join(" "),
    content: (
      <dl className="learn-glossary">
        {glossary.map(([term, description]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    ),
  },
];

/** Present an isolated, keyboard-accessible A2L handbook without changing open documents. */
export default function LearningGuide({
  onClose,
  onAbout,
}: {
  onClose: () => void;
  onAbout: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [chapterId, setChapterId] = useState("basics");
  const [query, setQuery] = useState("");
  const [visited, setVisited] = useState(() => new Set(["basics"]));
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapters[index];
  const filtered = chapters.filter((item) =>
    `${item.title} ${item.summary} ${item.terms}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);
  function selectChapter(id: string) {
    setChapterId(id);
    setVisited((previous) => new Set([...previous, id]));
    contentRef.current?.scrollTo({ top: 0 });
  }
  return (
    <dialog
      ref={dialogRef}
      className="learning-guide"
      aria-labelledby="learning-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="learn-header">
        <div className="learn-brand">
          <BookOpen size={21} />
          <div>
            <h1 id="learning-title">A2L Handbook</h1>
            <span>From first principles to confident inspection</span>
          </div>
        </div>
        <button
          className="icon-button"
          title="Close A2L guide"
          aria-label="Close A2L guide"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="learn-layout">
        <aside className="learn-sidebar" aria-label="Guide chapters">
          <label className="learn-search">
            <Search size={15} />
            <input
              autoFocus
              type="search"
              placeholder="Find a topic…"
              aria-label="Search A2L guide"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <nav aria-label="A2L learning chapters">
            {filtered.map((item) => (
              <button
                key={item.id}
                className={item.id === chapterId ? "active" : ""}
                aria-current={item.id === chapterId ? "page" : undefined}
                onClick={() => selectChapter(item.id)}
              >
                <span>
                  {String(chapters.indexOf(item) + 1).padStart(2, "0")}
                </span>
                <strong>{item.title}</strong>
                {visited.has(item.id) && (
                  <Check size={12} aria-label="Visited" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="learn-no-results">
                No matching topics.
                <button onClick={() => setQuery("")}>Clear search</button>
              </div>
            )}
          </nav>
          <div className="learn-progress">
            {visited.size} of {chapters.length} chapters visited
            <progress
              value={visited.size}
              max={chapters.length}
              aria-label="Chapters visited"
            />
          </div>
        </aside>
        <section
          className="learn-main"
          tabIndex={0}
          ref={contentRef}
          aria-label={chapter.title}
        >
          <div className="learn-mobile-nav">
            <label className="learn-search learn-mobile-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Find a topic..."
                aria-label="Search A2L guide"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label htmlFor="learn-chapter">Chapter</label>
            <select
              id="learn-chapter"
              value={filtered.some((item) => item.id === chapterId) ? chapterId : ""}
              onChange={(event) => selectChapter(event.target.value)}
            >
              {!filtered.some((item) => item.id === chapterId) && (
                <option value="" disabled>
                  {filtered.length ? "Select a topic" : "No matching topics"}
                </option>
              )}
              {filtered.map((item) => (
                <option key={item.id} value={item.id}>
                  {chapters.indexOf(item) + 1}. {item.title}
                </option>
              ))}
            </select>
          </div>
          <article>
            <div className="learn-chapter-number">
              CHAPTER {String(index + 1).padStart(2, "0")}
            </div>
            <h2>{chapter.title}</h2>
            <p className="learn-summary">{chapter.summary}</p>
            {chapter.content}
          </article>
        </section>
      </div>
      <footer className="learn-footer">
        <button className="learn-about" onClick={onAbout}>
          <Info size={14} />
          About Studio
        </button>
        <div>
          <button
            className="outline-button small"
            disabled={index === 0}
            onClick={() => selectChapter(chapters[index - 1].id)}
          >
            <ArrowLeft size={14} />
            Previous
          </button>
          <span>
            {index + 1} / {chapters.length}
          </span>
          <button
            className="primary small"
            disabled={index === chapters.length - 1}
            onClick={() => selectChapter(chapters[index + 1].id)}
          >
            Next
            <ArrowRight size={14} />
          </button>
        </div>
      </footer>
    </dialog>
  );
}
