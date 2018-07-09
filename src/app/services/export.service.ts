/**
 * Copyright 2017 - 2018  The Hyve B.V.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Injectable} from '@angular/core';
import {ExportDataType} from '../models/export-models/export-data-type';
import {ConstraintService} from './constraint.service';
import {ResourceService} from './resource.service';
import {ExportJob} from '../models/export-models/export-job';
import {DataTableService} from './data-table.service';
import {saveAs} from 'file-saver';
import {DatePipe} from '@angular/common';
import {MessageHelper} from '../utilities/message-helper';
import {ErrorHelper} from '../utilities/error-helper';
import {HttpErrorResponse} from '@angular/common/http';

@Injectable()
export class ExportService {

  private _exportDataTypes: ExportDataType[] = [];
  private _exportJobs: ExportJob[] = [];
  private _exportJobName: string;
  private _isLoadingExportDataTypes = false;

  constructor(private constraintService: ConstraintService,
              private resourceService: ResourceService,
              private dataTableService: DataTableService,
              private datePipe: DatePipe) {
  }

  public updateExports() {
    let combo = this.constraintService.constraint_1_2();
    // update the export info
    this.isLoadingExportDataTypes = true;
    this.resourceService.getExportDataTypes(combo)
      .subscribe(dataTypes => {
        this.exportDataTypes = dataTypes;
        this.isLoadingExportDataTypes = false;
      });
  }

  /**
   * Create the export job when the user clicks the 'Export selected sets' button
   */
  createExportJob(): Promise<any> {
    return new Promise((resolve, reject) => {
      let exportDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd HH.mm');
      let name = this.exportJobName ? this.exportJobName.trim() + ' ' + exportDate : '';

      if (this.validateExportJob(name)) {
        let summary = 'Running export job "' + name + '".';
        MessageHelper.alert('info', summary);
        this.resourceService.createExportJob(name)
          .subscribe(
            (newJob: ExportJob) => {
              summary = 'Export job "' + name + '" is created.';
              MessageHelper.alert('success', summary);
              this.exportJobName = '';
              this.runExportJob(newJob)
                .then(() => {
                  resolve(true);
                })
                .catch(err => {
                  reject(err)
                });
            },
            (err: HttpErrorResponse) => {
              ErrorHelper.handleError(err);
              reject(`Fail to create export job ${name}.`);
            }
          );
      } else {
        reject(`Invalid export job ${name}`);
      }
    });
  }

  /**
   * Run the just created export job
   * @param job
   */
  public runExportJob(job: ExportJob): Promise<any> {
    return new Promise((resolve, reject) => {
      let constraint = this.constraintService.constraint_1_2();
      this.resourceService.runExportJob(job, this.exportDataTypes, constraint, this.dataTableService.dataTable)
        .subscribe(
          returnedExportJob => {
            if (returnedExportJob) {
              this.updateExportJobs()
                .then(() => {
                  resolve(true);
                })
                .catch(err => {
                  reject(err);
                });
            } else {
              reject(`Fail to run export job ${job.jobName}, server returns undefined job.`);
            }
          },
          (err: HttpErrorResponse) => {
            ErrorHelper.handleError(err);
            reject(`Fail to run export job ${job.jobName}.`);
          }
        );
    });
  }

  /**
   * When an export job's status is 'completed', the user can click the Download button,
   * then the files of that job can be downloaded
   * @param job
   */
  downloadExportJob(job: ExportJob) {
    job.isInDisabledState = true;
    this.resourceService.downloadExportJob(job.id)
      .subscribe(
        (data) => {
          let blob = new Blob([data], {type: 'application/zip'});
          saveAs(blob, `${job.jobName}.zip`, true);
        },
        (err: HttpErrorResponse) => {
          ErrorHelper.handleError(err);
        },
        () => {
          MessageHelper.alert('success', `Export ${job.jobName} download completed`);
        }
      );
  }

  cancelExportJob(job) {
    job.isInDisabledState = true;
    this.resourceService.cancelExportJob(job.id)
      .subscribe(
        response => {
          this.updateExportJobs();
        },
        (err: HttpErrorResponse) => {
          ErrorHelper.handleError(err);
        }
      );
  }

  archiveExportJob(job) {
    job.isInDisabledState = true;
    this.resourceService.archiveExportJob(job.id)
      .subscribe(
        response => {
          this.updateExportJobs();
        },
        (err: HttpErrorResponse) => {
          ErrorHelper.handleError(err);
        }
      );
  }

  updateExportJobs(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.resourceService.getExportJobs()
        .subscribe(
          jobs => {
            jobs.forEach(job => {
              job.isInDisabledState = false
            });
            this.exportJobs = jobs;
            resolve(true);
          },
          (err: HttpErrorResponse) => {
            ErrorHelper.handleError(err);
            reject('Fail to update export jobs.');
          }
        );
    });
  }

  /**
   * Validate a new exportJob
   * @param {string} name
   * @returns {boolean}
   */
  private validateExportJob(name: string): boolean {
    let validName = name !== '';

    // 1. Validate if job name is specified
    if (!validName) {
      const summary = 'Please specify the job name.';
      MessageHelper.alert('warn', summary);
      return false;
    }

    // 2. Validate if job name is not duplicated
    for (let job of this.exportJobs) {
      if (job['jobName'] === name) {
        const summary = 'Duplicate job name, choose a new name.';
        MessageHelper.alert('warn', summary);
        return false;
      }
    }

    // 3. Validate if at least one data type is selected
    if (!this.exportDataTypes.some(ef => ef['checked'] === true)) {
      const summary = 'Please select at least one data type.';
      MessageHelper.alert('warn', summary);
      return false;
    }

    // 4. Validate if at least one file format is selected for checked data formats
    for (let dataFormat of this.exportDataTypes) {
      if (dataFormat['checked'] === true) {
        if (!dataFormat['fileFormats'].some(ff => ff['checked'] === true)) {
          const summary = 'Please select at least one file format for ' + dataFormat['name'] + ' data format.';
          MessageHelper.alert('warn', summary);
          return false;
        }
      }
    }

    // 5. Validate if at least one observation is included
    // TODO: refactor this, while avoiding cyclic dependencies between expoert service and query service
    // if (this.queryService.observationCount_2 < 1) {
    //   const summary = 'No observation included to be exported.';
    //   MessageHelper.alert('warn', summary);
    //   return false;
    // }

    return true;
  }

  get exportDataTypes(): ExportDataType[] {
    return this._exportDataTypes;
  }

  set exportDataTypes(value: ExportDataType[]) {
    this._exportDataTypes = value;
  }

  get isLoadingExportDataTypes(): boolean {
    return this._isLoadingExportDataTypes;
  }

  set isLoadingExportDataTypes(value: boolean) {
    this._isLoadingExportDataTypes = value;
  }

  get exportJobs(): ExportJob[] {
    return this._exportJobs;
  }

  set exportJobs(value: ExportJob[]) {
    this._exportJobs = value;
  }

  get exportJobName(): string {
    return this._exportJobName;
  }

  set exportJobName(value: string) {
    this._exportJobName = value;
  }
}
