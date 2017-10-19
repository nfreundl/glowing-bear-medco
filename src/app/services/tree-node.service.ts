import {Injectable} from '@angular/core';
import {Study} from '../models/study';
import {Constraint} from '../models/constraints/constraint';
import {Concept} from '../models/concept';
import {StudyConstraint} from '../models/constraints/study-constraint';
import {ConceptConstraint} from '../models/constraints/concept-constraint';
import {CombinationConstraint} from '../models/constraints/combination-constraint';
import {TreeNode} from 'primeng/primeng';
import {ResourceService} from './resource.service';
import {Query} from '../models/query';

type LoadingState = 'loading' | 'complete';

@Injectable()
export class TreeNodeService {

  // the variable that holds the entire tree structure, used by the tree on the left
  public treeNodes: TreeNode[] = [];
  // the entire tree table data that holds the patients' observations in the 2nd step (projection)
  private _treeTableData: TreeNode[] = [];
  // the selected tree table data that holds the patients' observations in the 2nd step (projection)
  private _selectedTreeTableData: TreeNode[] = [];

  // the status indicating the when the tree is being loaded or finished loading
  public loadingTreeNodes: LoadingState = 'complete';
  private _studies: Study[] = [];
  private studyConstraints: Constraint[] = [];
  private _concepts: Concept[] = [];
  private conceptConstraints: Constraint[] = [];
  private _queries: Query[] = [];

  // List keeping track of all available constraints. By default, the empty
  // constraints are in here. In addition, (partially) filled constraints are
  // added. The constraints should be copied when editing them.
  private allConstraints: Constraint[] = [];

  constructor(private resourceService: ResourceService) {
    this.loadEmptyConstraints();
    this.loadStudies();
    this.loadTreeNodes();
    this.loadQueries();
  }

  private loadEmptyConstraints() {
    this.allConstraints.push(new CombinationConstraint());
    this.allConstraints.push(new StudyConstraint());
    this.allConstraints.push(new ConceptConstraint());
  }

  private loadStudies() {
    this.resourceService.getStudies()
      .subscribe(
        studies => {
          // reset studies and study constraints
          this.studies = studies;
          this.studyConstraints = [];
          studies.forEach(study => {
            let constraint = new StudyConstraint();
            constraint.studies.push(study);
            this.studyConstraints.push(constraint);
            this.allConstraints.push(constraint);
          });
        },
        err => console.error(err)
      );
  }

  /**
   * Extracts concepts (and later possibly other dimensions) from the
   *  provided TreeNode array and their children.
   *  And augment tree nodes with PrimeNG tree-ui specifications
   * @param treeNodes
   */
  private processTreeNodes(treeNodes: object[]) {
    if (!treeNodes) {
      return;
    }
    for (let node of treeNodes) {
      this.processTreeNode(node);
      if (node['children']) {
        this.processTreeNodes(node['children']);
      }
    }
  }

  private processTreeNode(node: Object) {
    // Extract concept
    if (node['dimension'] === 'concept') {

      // Only include non-FOLDERs and non-CONTAINERs
      if (node['visualAttributes'].indexOf('FOLDER') === -1 &&
        node['visualAttributes'].indexOf('CONTAINER') === -1) {

        let concept = new Concept();
        // TODO: retrieve concept path in less hacky manner:
        let path = node['constraint']['path'];
        concept.path = path ? path : node['fullName'];
        concept.type = node['type'];
        this.concepts.push(concept);

        let constraint = new ConceptConstraint();
        constraint.concept = concept;
        this.conceptConstraints.push(constraint);
        this.allConstraints.push(constraint);
      }
    }
    // Add PrimeNG visual properties for tree nodes
    let countStr = ' ';
    node['label'] = node['name'] + countStr;
    if (node['metadata']) {
      node['label'] = node['label'] + ' ⚆';
    }
    if (node['children']) {
      if (node['type'] === 'UNKNOWN') {
        node['expandedIcon'] = 'fa-folder-open';
        node['collapsedIcon'] = 'fa-folder';
      } else if (node['type'] === 'STUDY') {
        node['expandedIcon'] = 'icon-folder-study-open';
        node['collapsedIcon'] = 'icon-folder-study';
      }
      node['icon'] = '';
    } else {
      if (node['type'] === 'NUMERIC') {
        node['icon'] = 'icon-123';
      } else if (node['type'] === 'HIGH_DIMENSIONAL') {
        node['icon'] = 'icon-hd';
      } else if (node['type'] === 'CATEGORICAL') {
        node['icon'] = 'icon-abc';
      } else if (node['type'] === 'DATE') {
        node['icon'] = 'fa-calendar';
      } else if (node['type'] === 'TEXT') {
        node['icon'] = 'fa-newspaper-o';
      } else {
        node['icon'] = 'fa-folder-o';
      }
    }
  }

  /**
   * Get the descendants of a tree node up to a predefined depth
   * @param {TreeNode} treeNode
   * @param {number} depth
   * @param {TreeNode[]} descendants
   */
  public getTreeNodeDescendantsWithDepth(treeNode: TreeNode,
                                         depth: number,
                                         descendants: TreeNode[]) {
    if (treeNode) {
      if (depth === 2) {
        if (treeNode['children']) {
          for (let child of treeNode['children']) {
            descendants.push(child);
          }
        }
      } else if (depth > 2) {
        if (treeNode['children']) {
          for (let child of treeNode['children']) {
            let newDepth = depth - 1;
            this.getTreeNodeDescendantsWithDepth(child, newDepth, descendants);
          }
        }
      }
    }
  }

  /**
   * Get the descendants of a tree node if a descendant has a type
   * that is not excluded
   * @param {TreeNode} treeNode
   * @param {string[]} excludedTypes
   * @param {TreeNode[]} descendants
   */
  public getTreeNodeDescendantsWithExcludedTypes(treeNode: TreeNode,
                                                 excludedTypes: string[],
                                                 descendants: TreeNode[]) {
    if (treeNode) {
      // If the tree node has children
      if (treeNode['children']) {
        for (let child of treeNode['children']) {
          if (child['children']) {
            this.getTreeNodeDescendantsWithExcludedTypes(child, excludedTypes, descendants);
          } else if (excludedTypes.indexOf(child['type']) === -1) {
            descendants.push(child);
          }
        }
      }
    }
  }

  /**
   * Update the tree table data for rendering the tree table in step 2, projection
   * based on a given set of concept codes as filtering criteria.
   * @param {Object} conceptCountMap
   */
  public updateTreeTableData(conceptCountMap: object, checklist: Array<string>) {
    let conceptCodes = [];
    for (let code in conceptCountMap) {
      conceptCodes.push(code);
    }
    this.treeTableData = this.updateTreeTableDataIterative(this.treeNodes, conceptCodes, conceptCountMap);
    this.selectedTreeTableData = [];
    this.checkTreeTableData(this.treeTableData, checklist);
  }

  private checkTreeTableData(nodes: TreeNode[], checklist: Array<string>) {
    for (let node of nodes) {
      if (!checklist || checklist.indexOf(node['fullName']) !== -1) {
        this.selectedTreeTableData.push(node);
      }
      if (node['children']) {
        this.checkTreeTableData(node['children'], checklist);
      }
    }
  }

  private updateTreeTableDataIterative(nodes: TreeNode[], conceptCodes: string[], conceptCountMap: object) {
    let nodesWithCodes = [];
    for (let node of nodes) {
      if (conceptCodes.indexOf(node['conceptCode']) !== -1) {
        let nodeCopy = this.copyTreeTableDataItem(node);
        if (conceptCountMap[node['conceptCode']]) {
          const patientCount = conceptCountMap[node['conceptCode']]['patientCount'];
          const obsevationCount = conceptCountMap[node['conceptCode']]['observationCount'];
          nodeCopy['data']['name'] = nodeCopy['data']['name'] + ` (sub: ${patientCount}, obs: ${obsevationCount})`;
        }
        nodesWithCodes.push(nodeCopy);
      } else if (node['children']) {
        let newNodeChildren = this.updateTreeTableDataIterative(node['children'], conceptCodes, conceptCountMap);
        if (newNodeChildren.length > 0) {
          let nodeCopy = this.copyTreeTableDataItem(node);
          nodeCopy['children'] = newNodeChildren;
          nodesWithCodes.push(nodeCopy);
        }
      }
    }
    return nodesWithCodes;
  }

  private copyTreeTableDataItem(item: TreeNode) {
    let itemCopy = Object.assign({}, item);
    itemCopy['data'] = {
      name: item['name']
    };
    itemCopy['expanded'] = true;
    return itemCopy;
  }

  /**
   * Iteratively load the descendants of the given tree node
   * @param parentNode
   */
  private loadTreeNext(parentNode) {
    let depth = 20;
    this.resourceService.getTreeNodes(parentNode['fullName'], depth, false, false)
      .subscribe(
        (treeNodes: object[]) => {
          const refNode = treeNodes && treeNodes.length > 0 ? treeNodes[0] : undefined;
          const children = refNode ? refNode['children'] : undefined;
          if (children) {
            parentNode['children'] = children;
          }
          this.processTreeNode(parentNode);
          this.processTreeNodes(children);
          let descendants = [];
          this.getTreeNodeDescendantsWithDepth(refNode, depth, descendants);
          if (descendants.length > 0) {
            for (let descendant of descendants) {
              this.loadTreeNext(descendant);
            }
          }
        },
        err => console.error(err)
      );
  }

  /**
   * Load the tree nodes for rendering the tree on the left side panel.
   */
  loadTreeNodes() {
    this.loadingTreeNodes = 'loading';
    // Retrieve all tree nodes and extract the concepts iteratively
    this.resourceService.getTreeNodes('\\', 2, false, false)
      .subscribe(
        (treeNodes: object[]) => {
          this.loadingTreeNodes = 'complete';
          // reset concepts and concept constraints
          this.concepts = [];
          this.conceptConstraints = [];
          this.processTreeNodes(treeNodes);
          treeNodes.forEach((function (node) {
            this.treeNodes.push(node); // to ensure the treeNodes pointer remains unchanged
            this.loadTreeNext(node);
          }).bind(this));
        },
        err => console.error(err)
      );
  }

  /**
   * Flag all tree nodes' selections to true or false
   * @param {boolean} flag
   */
  public selectAllTreeNodes(flag: boolean) {
    this.selectAllTreeNodesIterative(this.treeNodes, flag);
  }

  private selectAllTreeNodesIterative(nodes: TreeNode[], flag: boolean) {
    for (let node of nodes) {
      node['selected'] = flag;
      if (node['partialSelected']) {
        node['partialSelected'] = false;
      }
      if (node['children']) {
        this.selectAllTreeNodesIterative(node['children'], flag);
      }
    }
  }

  /**
   * Given a list of tree nodes, find and return
   * the node(s) that are on the topmost of the hierarchies of their respective branches
   * e.g.
   * given these nodes:
   * [ A\B\C,
   *   A\B
   *   A\D\E,
   *   A\D\E\F,
   *   A\E ]
   * --------------------------
   * return:
   * [ A\B,
   *   A\D\E,
   *   A\E ]
   * @param {TreeNode[]} treeNodes
   * @returns {TreeNode[]}
   */
  public getTopTreeNodes(treeNodes: TreeNode[]): TreeNode[] {
    let candidates = [];
    let result = [];
    for (let node of treeNodes) {
      const path = node['fullName'];
      let isPathUsed = false;
      for (let candidate of candidates) {
        if (path.indexOf(candidate) > -1) {
          // if the candidate is part of the path
          isPathUsed = true;
          break;
        } else if (candidate.indexOf(path) > -1) {
          // if the path is part of the candidate
          // remove the candidate, replace it with the path
          const index = candidates.indexOf(candidate);
          candidates.splice(index, 1);
          candidates.push(path);
          result.splice(index, 1);
          result.push(node);
          isPathUsed = true;
          break;
        }
      }
      if (!isPathUsed) {
        candidates.push(path);
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Find the tree nodes that have the fullNames (i.e. tree paths) in the given paths
   * @param {TreeNode[]} nodes
   * @param {string[]} paths
   * @param {TreeNode[]} foundNodes
   */
  public findTreeNodesByPaths(nodes: TreeNode[], paths: string[], foundNodes: TreeNode[]) {
    for (let node of nodes) {
      if (paths.indexOf(node['fullName']) !== -1) {
        foundNodes.push(node);
      }
      if (node['children']) {
        this.findTreeNodesByPaths(node['children'], paths, foundNodes);
      }
    }
  }

  /**
   * Find the ancestors of a tree node
   * @param node
   * @returns {Array}
   */
  public findTreeNodeAncestors(node) {
    let fullName = node['fullName'];
    let partsTemp = fullName.split('\\');
    let parts = [];
    for (let part of partsTemp) {
      if (part !== '') {
        parts.push(part);
      }
    }
    let endingIndices = [];
    for (let i = 0; i < parts.length - 1; i++) {
      endingIndices.push(i);
    }
    let paths = [];
    for (let index of endingIndices) {
      let path = '\\';
      for (let i = 0; i <= index; i++) {
        path += parts[i] + '\\';
      }
      paths.push(path);
    }
    let foundNodes = [];
    this.findTreeNodesByPaths(this.treeNodes, paths, foundNodes);
    return foundNodes;
  }

  /**
   * Update the queries on the left-side panel
   */
  public loadQueries() {
    this.resourceService.getQueries()
      .subscribe(
        (queries) => {
          this.queries.length = 0;
          let bookmarkedQueries = [];
          queries.forEach(query => {
            query['collapsed'] = true;
            if (query['bookmarked']) {
              bookmarkedQueries.push(query);
            } else {
              this.queries.push(query);
            }
          });
          this.queries = bookmarkedQueries.concat(this.queries);
        },
        err => console.error(err)
      );
  }

  get concepts(): Concept[] {
    return this._concepts;
  }

  set concepts(value: Concept[]) {
    this._concepts = value;
  }

  get studies(): Study[] {
    return this._studies;
  }

  set studies(value: Study[]) {
    this._studies = value;
  }

  get queries(): Query[] {
    return this._queries;
  }

  set queries(value: Query[]) {
    this._queries = value;
  }

  get treeTableData(): TreeNode[] {
    return this._treeTableData;
  }

  set treeTableData(value: TreeNode[]) {
    this._treeTableData = value;
  }

  get selectedTreeTableData(): TreeNode[] {
    return this._selectedTreeTableData;
  }

  set selectedTreeTableData(value: TreeNode[]) {
    this._selectedTreeTableData = value;
  }

  /**
   * Returns a list of all constraints that match the query string.
   * The constraints should be copied when editing them.
   * @param query
   * @returns {Array}
   */
  searchAllConstraints(query: string): Constraint[] {
    query = query.toLowerCase();
    let results = [];
    this.allConstraints.forEach((constraint: Constraint) => {
      let text = constraint.textRepresentation.toLowerCase();
      if (text.indexOf(query) > -1) {
        results.push(constraint);
      }
    });
    return results;
  }

  /**
   * Check if a tree node is a concept node
   * @param {TreeNode} node
   * @returns {boolean}
   */
  public isTreeNodeAconcept(node: TreeNode): boolean {
    const type = node['type'];
    return (type === 'NUMERIC' || type === 'CATEGORICAL' || type === 'DATE') ? true : false;
  }

  /**
   * Check if a tree node is a study node
   * @param {TreeNode} node
   * @returns {boolean}
   */
  public isTreeNodeAstudy(node: TreeNode): boolean {
    return node['type'] === 'STUDY' ? true : false;
  }

}