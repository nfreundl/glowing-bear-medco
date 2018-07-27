/**
 * Copyright 2017 - 2018  The Hyve B.V.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Study} from '../../models/constraint-models/study';
import {AsyncSubject} from 'rxjs/AsyncSubject';
import {Observable} from 'rxjs/Observable';
import {map} from 'rxjs/operators';

export class StudiesServiceMock {

  private _loaded: AsyncSubject<boolean> = new AsyncSubject<boolean>();
  private _studies: Study[] = [];
  private _existsPublicStudy = false;
  private _existsTrialVisitDimension = false;

  constructor() {
    let study1 = new Study();
    study1.id = 'Study1';
    study1.public = false;
    study1.dimensions = ['patient', 'concept', 'trial visit'];
    this._studies.push(study1);
    this._existsPublicStudy = this.studies.some((study: Study) => study.public);
    this._existsTrialVisitDimension = this.studies.some((study: Study) =>
      study.dimensions.includes('trial visit')
    );
    this._loaded.next(true);
    this._loaded.complete();
  }

  init() {
  }

  get studies(): Study[] {
    return this._studies;
  }

  set studies(value: Study[]) {
    this._studies = value;
  }

  get studiesLoaded(): AsyncSubject<boolean> {
    return this._loaded;
  }

  get existsPublicStudy(): Observable<boolean> {
    return this._loaded.asObservable().pipe(map(() =>
      this._existsPublicStudy
    ));
  }

  get existsTrialVisitDimension(): Observable<boolean> {
    return this._loaded.asObservable().pipe(map(() =>
      this._existsTrialVisitDimension
    ));
  }

}
