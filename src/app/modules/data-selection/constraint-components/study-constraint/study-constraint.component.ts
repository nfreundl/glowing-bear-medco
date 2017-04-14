import { Component, OnInit } from '@angular/core';
import {Study} from "../../../shared/models/study";
import {StudyConstraint} from "../../../shared/models/constraints/study-constraint";
import {ConstraintComponent} from "../constraint/constraint.component";
import {ResourceService} from "../../../shared/services/resource.service";

@Component({
  selector: 'study-constraint',
  templateUrl: './study-constraint.component.html',
  styleUrls: ['./study-constraint.component.css', '../constraint/constraint.component.css']
})
export class StudyConstraintComponent extends ConstraintComponent implements OnInit  {

  private studies: Study[];
  searchResults: Study[];

  constructor(private resourceService: ResourceService) {
    super();
  }

  ngOnInit() {
    this.resourceService.getStudies()
      .subscribe(
        studies => this.studies = studies,
        err => console.error(err)
      );
  }

  onSelect(selectedStudy) {
    (<StudyConstraint>this.constraint).study = selectedStudy;
  }

  search(event) {
    this.searchResults = this.studies.filter((study:Study) => study.studyId.toLowerCase().includes(event.query.toLowerCase()));
  }

}
