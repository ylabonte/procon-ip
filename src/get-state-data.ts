/**
 * The [[`GetStateData`]] class is parser and access helper for the CSV response
 * data of the `/GetState.csv` endpoint (see {@linkcode GetStateService}). The
 * [[`GetStateCategory`]] enum can be used to retrieve data objects categorized
 * according to the endpoint description (see [ProCon.IP manual](http://www.pooldigital.de/trm/TRM_ProConIP.pdf)).
 * @packageDocumentation
 */

import { GetStateDataObject } from './get-state-data-object';
import { GetStateDataSysInfo } from './get-state-data-sys-info';
import { RelayDataObject } from './relay-data-object';

/**
 * Enum of valid categories that can be used with 
 * [[`GetStateData.getDataObjectsByCategory`]].
 * 
 * Categories are based on the official API documentation.
 * 
 * See manual (search for _GetState.csv_): http://www.pooldigital.de/trm/TRM_ProConIP.pdf
 */
export enum GetStateCategory {
  /**
   * Internal time of the ProCon.IP when processing the corresponding request.
   * Hence there is only one item in this category.
   */
  TIME = 'time',

  /**
   * Category for analog channels.
   */
  ANALOG = 'analog',

  /**
   * Category for electrode readings.
   */
  ELECTRODES = 'electrodes',

  /**
   * Category for temperature sensor values.
   */
  TEMPERATURES = 'temperatures',

  /**
   * Category for internal relays.
   */
  RELAYS = 'relays',

  /**
   * Category for digital inputs.
   */
  DIGITAL_INPUT = 'digitalInput',

  /**
   * Category for external relays.
   */
  EXTERNAL_RELAYS = 'externalRelays',

  /**
   * Category for canister filling levels.
   */
  CANISTER = 'canister',

  /**
   * Category for canister consumptions.
   */
  CANISTER_CONSUMPTION = 'canisterConsumptions',
}

/**
 * This class is parser and access helper at once with integrated object 
 * representation for the response CSV of the [[`GetStateService`]].
 * (_This might be changed/split in seperate classes in a future refactoring_)
 */
export class GetStateData {
  /**
   * Extend the data object instances as you like.
   */
  [key: string]: any;

  /**
   * Raw CSV input string (retrieved by the [[`GetStateService`]]).
   */
  public raw: string;

  /**
   * CSV input parsed to a simple 2-dimensional array.
   * 
   * Structure:
   * ```
   * [
   *   0: [ // line one
   *     0: // line one, column one
   *     1: // line one, column two
   *   ],
   *   1: [ // line two
   *     0: // line two, column one
   *     ...
   *   ...
   * ]
   * ```
   */
  public parsed: string[][];

  /**
   * SysInfo column data.
   * 
   * The first line of the csv has no relation to the rest of the CSV. So it
   * is stored seperately in here.
   */
  public sysInfo: GetStateDataSysInfo;

  /**
   * Actual data objects for further processing.
   * 
   * Ordered by CSV column position starting at 0.
   */
  public objects: GetStateDataObject[];

  /**
   * Lists all indices of objects that are not labeled with 'n.a.' and therefore
   * considered to be active.
   */
  public active: number[];

  /**
   * Data categories as array of objects.
   *
   * Category names as keys and arrays as values. These arrays list columns 
   * (referencing the [[`parsed`]] CSV) which fall into this category.
   * The array values might contain simple listings of the column positions or
   * another array containing the starting and ending index of a slice/range.
   * Counting columns starts at 0. The value is of type `any` to simplify
   * dynamic iteration without linting or parsing errors.
   */
  public readonly categories: any = {
    /**
     * Internal time of the ProCon.IP when processing the corresponding request.
     * Hence there is only one item in this category. _Read from **column 0**
     * of the CSV._
     */
    time: [0],

    /**
     * Category for analog channels.
     * 
     * _Read from **column 1 to 5** of the CSV._
     */
    analog: [[1, 5]],

    /**
     * Category for electrode readings.
     * 
     * _Read from **columns 6 and 7** of the CSV._
     */
    electrodes: [6, 7],

    /**
     * Category for temperature sensor values.
     * 
     * _Read from **column 8 to 15** of the CSV._
     */
    temperatures: [[8, 15]],

    /**
     * Category for internal relay values.
     * 
     * _Read from **column 16 to 23** of the CSV._
     */
    relays: [[16, 23]],

    /**
     * Category for digital input values.
     * 
     * _Read from **column 24 to 27** of the CSV._
     */
    digitalInput: [[24, 27]],

    /**
     * Category for external relay values.
     * 
     * _Read from **column 28 to 35** of the CSV._
     */
    externalRelays: [[28, 35]],

    /**
     * Category for canister values.
     * 
     * _Read from **column 36 to 38** of the CSV._
     */
    canister: [[36, 38]],

    /**
     * Category for canister consumptions.
     * 
     * _Read from **column 39 to 41** of the CSV._
     */
    canisterConsumptions: [[39, 41]],
  };

  /**
   * Initialize new [[`GetStateData`]] instance.
   * 
   * @param rawData Plain response string of the [[`GetStateService`]] or the 
   *                `/GetState.csv` API endpoint.
   */
  public constructor(rawData?: string) {
    this.objects = [];
    this.active = [];
    if (rawData === undefined) {
      this.raw = '';
      this.parsed = [[]];
      this.sysInfo = new GetStateDataSysInfo();
    } else {
      // Save raw input string.
      this.raw = rawData;
      // Parse csv into 2-dimensional array of strings.
      this.parsed = this.raw
        .split(/[\r\n]+/) // split rows
        .map((row) => row.split(/[,]/)) // split columns
        .filter((row) => row.length > 1 || (row.length === 1 && row[0].trim().length > 1)); // remove blank lines
      // Save common system information.
      this.sysInfo = new GetStateDataSysInfo(this.parsed);
      this.resolveObjects();
    }
  }

  /**
   * Get the category of a data item by its column index.
   * 
   * @param index Column index
   * @returns Category name or string `none` if no category could be identified.
   */
  public getCategory(index: number): string {
    for (const category in this.categories) {
      if (this.categories[category].indexOf(index) >= 0) {
        return category;
      }
    }

    return 'none';
  }

  /**
   * Get [[`GetStateDataObject`]] objects by index.
   * 
   * @param indices An array of object indices specifying the return objects.
   * @param activeOnly Optionally filter for active objects only.
   */
  public getDataObjects(indices: number[], activeOnly = false): GetStateDataObject[] {
    return activeOnly
      ? this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0 && this.active.indexOf(idx) >= 0)
      : this.objects.filter((obj, idx) => indices.indexOf(idx) >= 0);
  }

  /**
   * Get a single [[`GetStateDataObject`]] by id aka column index.
   * 
   * @param id Object column index.
   */
  public getDataObject(id: number): GetStateDataObject {
    return this.objects[id] ? this.objects[id] : new GetStateDataObject(id, '', '', '', '', '');
  }

  /**
   * Get all data objects of a given category.
   * 
   * @param category A valid category string (see [[`GetStateCategory`]])
   * @param activeOnly Optionally filter for active objects only.
   */
  public getDataObjectsByCategory(category: string, activeOnly = false): GetStateDataObject[] {
    return this.getDataObjects(this.categories[category as GetStateCategory], activeOnly);
  }

  /**
   * Get the object id aka column index of the chlorine dosage control relay.
   */
  public getChlorineDosageControlId(): number {
    return Math.min(...this.categories.relays) + Number(this.sysInfo.chlorineDosageRelais);
  }

  /**
   * Get the object id aka column index of the pH minus dosage control relay.
   */
  public getPhMinusDosageControlId(): number {
    return Math.min(...this.categories.relays) + Number(this.sysInfo.phMinusDosageRelais);
  }

  /**
   * Get the object id aka column index of the pH plus dosage control relay.
   */
  public getPhPlusDosageControlId(): number {
    return Math.min(...this.categories.relays) + Number(this.sysInfo.phPlusDosageRelais);
  }

  /**
   * Get the chlorine dosage control [[`RelayDataObject`]].
   */
  public getChlorineDosageControl(): RelayDataObject {
    return new RelayDataObject(this.getDataObject(this.getChlorineDosageControlId()));
  }

  /**
   * Get the pH- dosage control [[`RelayDataObject`]].
   */
  public getPhMinusDosageControl(): RelayDataObject {
    return new RelayDataObject(this.getDataObject(this.getPhMinusDosageControlId()));
  }

  /**
   * Get the pH+ dosage control [[`RelayDataObject`]].
   */
  public getPhPlusDosageControl(): RelayDataObject {
    return new RelayDataObject(this.getDataObject(this.getPhPlusDosageControlId()));
  }

  /**
   * Check whether the given id refers to a dosage control [[`RelayDataObject`]].
   */
  public isDosageControl(id: number): boolean {
    return (
      [this.getChlorineDosageControlId(), this.getPhMinusDosageControlId(), this.getPhPlusDosageControlId()].indexOf(
        id,
      ) >= 0
    );
  }

  /**
   * Parse the CSV string into a 2-dimensional array structure and into
   * [[`GetStateDataObject`]] and [[`RelayDataObject`]] objects.
   * 
   * @param csv Raw CSV input string (response of the `/GetState.csv` endpoint)
   */
  public parseCsv(csv: string): void {
    // Save raw input string.
    this.raw = csv;
    // Parse csv into 2-dimensional array of strings.
    this.parsed = csv
      .split(/[\r\n]+/) // split rows
      .map((row) => row.split(/[,]/)) // split columns
      .filter((row) => row.length > 1 || (row.length === 1 && row[0].trim().length > 1)); // remove blank lines
    // Save common system information.
    this.sysInfo = new GetStateDataSysInfo(this.parsed);
    this.resolveObjects();
  }

  /**
   * @internal
   */
  private resolveObjects(): void {
    // Iterate data columns.
    this.active.length = 0;
    this.parsed[1].forEach((name, index) => {
      if (this.objects[index] === undefined) {
        // Add object to the objects array.
        this.objects[index] = new GetStateDataObject(
          index,
          name,
          this.parsed[2][index],
          this.parsed[3][index],
          this.parsed[4][index],
          this.parsed[5][index],
        );
      } else {
        this.objects[index].set(
          index,
          name,
          this.parsed[2][index],
          this.parsed[3][index],
          this.parsed[4][index],
          this.parsed[5][index],
        );
      }

      if (this.objects[index].active) {
        this.active.push(index);
      }
    });
    this.categorize();
  }

  /**
   * @internal
   */
  private categorize(): void {
    Object.keys(this.categories).forEach((category) => {
      let catId = 1;
      this.categories[category] = this.expandSlice(this.categories[category]);
      this.categories[category].forEach((id: number) => {
        if (this.objects[id] !== undefined) {
          this.objects[id].categoryId = catId++;
          this.objects[id].category = category;
        }
      });
    });
  }

  /**
   * @param input 
   * @internal
   */
  private expandSlice(input: number[][]): number[] {
    const output = new Array<number>();
    input.forEach((def) => {
      if (Number.isInteger(Number(def))) {
        output.push(Number(def));
      }
      if (Array.isArray(def)) {
        def.map((subDef) => Number(subDef));
        for (let i = Number(def[0]); i <= Number(def[1]); i++) {
          output.push(i);
        }
      }
    });

    return output;
  }
}
