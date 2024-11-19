import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  selectSupportItemsResponseerror,
  SupportItemsState,
} from 'src/app/state-management/selectors/support-items-list.selector';
import {
  CreateTicketResponse,
  ProductTypes,
  ProductTiles,
  ProductTilesDetsils,
  SubItem2,
  SubItem
} from 'src/app/models/depot-models';
import { MatDialog } from '@angular/material/dialog';
import { LogService } from 'src/app/services/log.service';
import { LogDetails } from 'src/app/models/log-models';
import {
  createTicketErrorSelector,
  createTicketResponse,
  StoreOSSelfAssistState,
} from 'src/app/state-management/selectors/self-assist.selector';
import {
  cleanSelfAssist,
  createServiceTicket,
} from 'src/app/state-management/actions/self-assist.actions';
import { HelpApiService } from 'src/app/services/help-api.service';
import { ElectronApiService } from 'src/app/services/electron-api.service';
import { sendAppDataToElectron } from 'src/app/utils/electronFunctions';
import { Location } from '@angular/common';
import {
  NgbModal,
  NgbModalOptions,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { AlertModalComponent } from '../alert-modal/alert-modal.component';
import { getSupportItemsList } from 'src/app/state-management/actions/support-items-list.actions';
import { selectSupportItemsList } from 'src/app/state-management/selectors/support-items-list.selector';
import { environment } from 'src/environments/environment';
import { Log } from 'src/app/models/log-message';
import { WindowMod } from '../../utils/smartTicketAndroid.interface';
import { Question, AnsField } from 'src/app/models/depot-models';
import { AbstractControl, ValidationErrors, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { HttpAccessService } from 'src/app/services/http-access.service';
import { HttpClient } from '@angular/common/http';
import { ILinkClickEvent, IPageViewEvent, ITicketEvent } from 'src/app/shared/models/alloyEvents';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AlloyEvtTypeEnum } from 'src/app/shared/enums/alloy-evt-type.enum';
import { format, isFuture, isValid } from 'date-fns';
import * as moment from 'moment';
import { BreakpointObserver } from '@angular/cdk/layout';
import { FilteredAttributesService } from 'src/app/services/filtered-attributes.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'storeos-support-tickets',
  templateUrl: './support-tickets.component.html',
  styleUrls: ['./support-tickets.component.scss'],
  providers: [{ provide: WindowMod, useValue: window }],
})
export class SupportTicketsComponent implements OnInit, AfterViewInit, OnDestroy {
  ticketIdInAlert = '';
  type: string = '';
  appName: string = '';
  windowId: any;
  storeNumber = '';
  employeeId = '';
  isServiceError = false;
  serviceErrorCode = '';
  serviceErrorMessage = '';
  invalidServiceError = '';
  step = 0;
  skipStep: boolean = false;
  previousStep = 0;
  alertMessage: string = '';
  ticketNumber = '';
  additionalMessage = '';
  enableBtn: false;
  alertTitle = 'Ticket Submitted';
  productTypeList: ProductTiles[] = [];
  // productSupportTiles: ProductTiles[] = [];
  nonTypeList: ProductTiles[];
  categories: ProductTiles[] = [];

  uniqueCategorie: any;
  tooltip: string;
  activeFields: AnsField[] = [];
  itemsList: any;
  subItemsList: any = [];
  isAlertModalOpen = false;
  alertModal: NgbModalRef;
  showQuery: boolean = false;
  queryText: string = '';
  dateText: string = '';
  isError = false;
  dateResult = false;
  platform: string = '';
  logMetadata: LogDetails = {
    module: 'selfAssistModule',
    component: 'SupportTicketsComponent',
  };
  selectedItem: any = {};
  model: any;
  currentDateTime = new Date();
  form = new FormGroup({
  });
  activeQuestions: Question[] = [];
  submited: any;
  currenthint: '';
  showinghint = false;
  maxlength = 300;
  input: any;
  tileId: number;
  isFormValid: boolean = true;
  errorMsg: string = '';
  index = 0;
  isOffline: string | null;
  isMobile: Boolean = false;
  isOther: boolean = false;
  private ticketResponseSubscription: Subscription;
  private ticketErrorResponseSubscription: Subscription;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private helpApiService: HelpApiService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private supportStore: Store<SupportItemsState>,
    private dialog: MatDialog,
    private logService: LogService,
    private _location: Location,
    private store: Store<StoreOSSelfAssistState>,
    private helpApi: HelpApiService,
    private electronapiservice: ElectronApiService,
    private analyticsService: AnalyticsService,
    private filteredAttributesService: FilteredAttributesService,
    private window: WindowMod,
    private fb: FormBuilder, private breakpointObserver: BreakpointObserver) {
    this.helpApi.getStoreNumber();
    // Sction dispatch to get Support Items
    this.store.dispatch(getSupportItemsList());

    // Selector to fetch all support items and group them to display as per mockups
    this.supportStore.select(selectSupportItemsList).subscribe(productSupportItemsList => {
      console.log('itemsList', productSupportItemsList);
      /*istanbul ignore else */
      if (productSupportItemsList) {
        const itemsList = productSupportItemsList?.supportItemsList?.tiles;

        if (itemsList?.length === 0) {
          this.isServiceError = true;
          return;
        }
        itemsList?.map((item: ProductTiles) => {
          if (!this.productTypeList?.length) {
            this.isServiceError = false;
            this.productTypeList.push(item);
          } else {
            const listValue = this.productTypeList?.filter(
              (typeItem) => typeItem.label === item.label
            );
            if (!listValue?.length) {
              this.productTypeList.push(item);
            }
          }
        });
        this.logService.info(this.logMetadata, 'constructor- getSupportItemsList() Success',
          `Response - ${JSON.stringify(itemsList)}`
        );
      }

      //filtering the free-form tile to sort the items alphabetically
      this.nonTypeList = this.productTypeList?.filter((x: any) => !x.type);
      this.productTypeList = this.productTypeList?.filter((x: any) => x.type);
      this.productTypeList.sort((a, b) => (a.label < b.label) ? -1 : 1);
      this.productTypeList.push(...this.nonTypeList);
      this.isOther = this.productTypeList?.filter((x: any) => x.label === 'Other').length > 0 && this.filteredAttributesService?.data?.EnableOther === 'Y'
        ? true : false;
    });

    // Selector to display error while fetching all support items
    this.supportStore.select(selectSupportItemsResponseerror).subscribe((error) => {
      this.handleError({ statusCode: error.statusCode, statusDescription: JSON.stringify(error), });
    });
  }
  ngAfterViewInit() {
    this.cdr.detectChanges();
  }
  /*
   * Angular default life cycle method
   * Subscribes queryparams to retrive data from url
   * Used to retrieve data on component initialization
   */
  /*
  ngOnInit(): void {
    // this.getDynamicData();
    
    this.tooltip = environment.messages.OTHER_TICKETS_TOOLTIP
    this.isError = false;
    window?.storeos?.system?.status().then((status: string) => {
      console.log('Status - ', status);
      if (status.toLowerCase() === "online") {
        this.isOffline = 'false';
      }
      else {
        this.isOffline = 'true';
      }
    });
    let logOnInit = new Log();
    this.logService.info(this.logMetadata, 'ngOnInit', logOnInit.message);
    this.route.queryParams.subscribe((params) => {
      this.logService.info(this.logMetadata, 'ngOnInit-queryParams', `Response - ${JSON.stringify(params)}`);
      console.log('params are ', params)
      if (params.type) {
        this.step++;
      }
      if (params.type === 'Free Form Tile') {
        this.showQuery = true;
      }
      if (params.type === 'Other') {

        this.showQuery = true;
      }
      this.type = params.type;
      logOnInit.message = `Type - ${this.type}`;
      this.appName = params.appName;
      logOnInit.message = `App Name - ${this.appName}`;
      this.storeNumber = params.storeNumber;
      logOnInit.message = `Store Number - ${this.storeNumber}`;
      this.employeeId = params.employeeId;
      logOnInit.message = `Employee Id - ${this.employeeId}`;
      this.platform = params.platform;
      this.isMobile = this.platform.toLowerCase() === 'mobile';
      this.tileId = params.id;
      if (this.type && this.type !== 'Other' && this.type !== 'Free Form Tile') {
        this.helpApi.getSupportTilesDetails(this.tileId)?.subscribe((response) => {
          this.logService.info(this.logMetadata, 'ngOnInit-getSupportTilesDetails() Success',
            `Response - ${JSON.stringify(response)}`);
          console.log('respos', response);
          this.uniqueCategorie = JSON.parse(JSON.stringify(response.data)).subItems;
          console.log('support tiels details', this.uniqueCategorie);
        });
      }
    });
  }
 */   
  
  ngOnInit(): void {
    // Initialize properties
    this.tooltip = environment.messages.OTHER_TICKETS_TOOLTIP;
    this.isError = false;
  
    // Check system status
    window?.storeos?.system?.status().then((status: string) => {
      console.log('Status - ', status);
      this.isOffline = status.toLowerCase() !== "online" ? 'true' : 'false';
    });
  
    // Log initialization
    const logOnInit = new Log();
    this.logService.info(this.logMetadata, 'ngOnInit', logOnInit.message);
  
    // Handle query params
    this.route.queryParams.subscribe((params) => {
      const { type, appName, storeNumber, employeeId, platform, id: tileId } = params;
  
      this.logService.info(this.logMetadata, 'ngOnInit-queryParams', `Response - ${JSON.stringify(params)}`);
      console.log('params are', params);
  
      // Update step and showQuery
      if (type) {
        this.step++;
        this.showQuery = ['Free Form Tile', 'Other'].includes(type);
      }
  
      // Assign properties
      this.type = type;
      this.appName = appName;
      this.storeNumber = storeNumber;
      this.employeeId = employeeId;
      this.platform = platform;
      this.tileId = tileId;
      this.isMobile = platform?.toLowerCase() === 'mobile';
  
      // Log each property
      logOnInit.message = `Type - ${this.type}`;
      logOnInit.message = `App Name - ${this.appName}`;
      logOnInit.message = `Store Number - ${this.storeNumber}`;
      logOnInit.message = `Employee Id - ${this.employeeId}`;
  
      // Fetch support tile details if applicable
      if (type && !['Other', 'Free Form Tile'].includes(type)) {
        this.helpApi.getSupportTilesDetails(tileId)?.subscribe((response) => {
          this.logService.info(this.logMetadata, 'ngOnInit-getSupportTilesDetails() Success', 
            `Response - ${JSON.stringify(response)}`);
          console.log('response', response);
          this.uniqueCategorie = response.data?.subItems ?? [];
          console.log('support tiles details', this.uniqueCategorie);
        });
      }
    });
  }
  

  /* show hint function*/
  showHint(hintText: any): void {
    console.log(hintText);
    this.showinghint = !this.showinghint;
    this.currenthint = hintText;
  }
  showImage(type: string) {
    return type !== 'Other' ? `assets/${type?.toLowerCase()}.svg` : 'assets/OtherIssue.svg';
  }
  onInputChange(event: any) {
    const value = event.target.value;
    if (value.length > this.maxlength) {
      event.target.value = value.substr(0, this.maxlength);
      event.preventDefault();
    }
  }
  /*
   * function handleError
   * Handles Http errors and receives status code and status description
   */
  private handleError(error: {
    statusCode?: string;
    statusDescription: string;
  }) {
    this.logService.error(
      this.logMetadata,
      'ngOnInit-getsupportTickets() Failure',
      `Error - ${JSON.stringify(error)}`
    );
    this.invalidServiceError = environment.messages.INVALID_SERVICE_ERROR;
    if (error.statusCode) {
      this.isServiceError = true;
    }

    this.serviceErrorCode = error?.statusCode || '0';
    this.serviceErrorMessage = 'System failure. Please retry';
  }

  /*
   * function showRegister
   * Param type accepts string
   * Navigates to display the categories step of Product Support
   */
  showRegister(label: string, id: number) {
    this.router.navigate(['/support-tickets'], {
      queryParams: {
        id,
        type: label,
        appName: this.appName,
        storeNumber: this.storeNumber,
        employeeId: this.employeeId,
        platform: this.platform,
      },
    });
  }

  /*
   * function handleCreateTicketResponse
   * Param response of CreateTicketResponse model
   * Creating a ticket and handles http errors while creating tickets
   */
  /*
  private handleCreateTicketResponse(response: CreateTicketResponse) {
    if (response?.statusCode === 'USER_CANCELLED') {
      return;
    }

    this.logService.info(
      this.logMetadata,
      'showBannerAlert',
      `Creating a service ticket response - ${JSON.stringify(response)}`
    );

    if (response && response.ticketId) {
      this.isError = false;
      this.alertTitle = 'Ticket Submitted';
      this.ticketNumber = response?.ticketId || 'unavailable';
      this.alertMessage = 'Your ticket has been successfully submitted. Your reference number is'
      this.additionalMessage = 'You may receive a phone call for additional details regarding your reported issue, if needed.'
      this.trackEvent({ ticketSubmit: 1, ticketStatus: this.alertTitle, ticketReason: this.additionalMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketSubmit);

    } else if (Number(response.statusCode) === 404) {
      this.isError = true;
      this.alertTitle = 'Unable to Submit Ticket';
      this.alertMessage = this.mapErrorCodeToUserMessage(
        response?.statusCode || '0'
      );
      this.trackEvent({ ticketError: 1, ticketErrorType: this.alertTitle, ticketReason: this.alertMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketError);
    } else if (response.statusCode && response.statusCode !== '' && Number(response.statusCode) >= 100 && Number(response.statusCode) <= 199) {
      this.isError = false;
      this.alertTitle = 'Ticket Submitted';
      this.ticketNumber = response?.ticketId || 'Pending';
      this.alertMessage = 'Your ticket has been successfully submitted. Your reference number is'
      this.additionalMessage = 'You may receive a phone call for additional details regarding your reported issue, if needed.'
      this.trackEvent({ ticketSubmit: 1, ticketStatus: this.alertTitle, ticketReason: this.additionalMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketSubmit);
    } else if (response.statusCode && response.statusCode !== '' && Number(response.statusCode) === 404) {
      this.isError = true;
      this.alertTitle = 'Unable to Submit Ticket';
      this.alertMessage = this.mapErrorCodeToUserMessage(
        response?.statusCode || '0'
      );
      this.trackEvent({ ticketError: 1, ticketErrorType: this.alertTitle, ticketReason: this.alertMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketError);
    } else {
      this.isError = true;
      this.alertTitle = 'Unable to Submit Ticket';
      this.alertMessage = this.mapErrorCodeToUserMessage(
        response?.statusCode || '0'
      );
      this.trackEvent({ ticketError: 1, ticketErrorType: this.alertTitle, ticketReason: this.alertMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketError);
    }
  }
*/

private handleCreateTicketResponse(response: CreateTicketResponse) {
  if (response?.statusCode === 'USER_CANCELLED') {
    return;
  }

  this.logService.info(
    this.logMetadata,
    'showBannerAlert',
    `Creating a service ticket response - ${JSON.stringify(response)}`
  );

  const isSuccessfulSubmission = response && response.ticketId;
  const isPendingSubmission = response?.statusCode && Number(response.statusCode) >= 100 && Number(response.statusCode) <= 199;
  const isNotFound = response?.statusCode && Number(response.statusCode) === 404;

  if (isSuccessfulSubmission || isPendingSubmission) {
    this.isError = false;
    this.alertTitle = 'Ticket Submitted';
    this.ticketNumber = response?.ticketId || (isPendingSubmission ? 'Pending' : 'unavailable');
    this.alertMessage = 'Your ticket has been successfully submitted. Your reference number is';
    this.additionalMessage = 'You may receive a phone call for additional details regarding your reported issue, if needed.';

    this.trackEvent({
      ticketSubmit: 1,
      ticketStatus: this.alertTitle,
      ticketReason: this.additionalMessage,
      ticketType: 'Product Support',
      ticketCategory: this.selectedItem.itemLabel
    }, AlloyEvtTypeEnum.TicketSubmit);
  } else if (isNotFound) {
    this.handleTicketError(response?.statusCode);
  } else {
    this.handleTicketError(response?.statusCode);
  }
}

private handleTicketError(statusCode: string | undefined) {
  this.isError = true;
  this.alertTitle = 'Unable to Submit Ticket';
  this.alertMessage = this.mapErrorCodeToUserMessage(statusCode || '0');
  
  this.trackEvent({
    ticketError: 1,
    ticketErrorType: this.alertTitle,
    ticketReason: this.alertMessage,
    ticketType: 'Product Support',
    ticketCategory: this.selectedItem.itemLabel
  }, AlloyEvtTypeEnum.TicketError);
}

  /*
   * function navigate
   * Param supportItem accepts ProductTypes model type
   * Navigates to display the items step from categories and create ticket step of Product Support
   */
  navigate(supportItem: any, registerNumber: any = '', submitted?: any): void {
    if (submitted) {
      this.submited = submitted;
    }
    if (this.step === 1) {
      if (supportItem.subItems) {
        this.subItemsList.push(supportItem.subItems);
        this.step = 2;
      } else if (supportItem.questions) {
        this.selectedItem = supportItem;
        this.activeFields = [];
        this.activeQuestions = supportItem.questions.filter((q: any) => q.isactive === true);
        const group: Record<string, any> = {};
        for (const question of this.activeQuestions) {
          for (const ansField of question.ansFields) {
            if (ansField.isactive === true) {
              this.activeFields.push(ansField);
              group[ansField.label] = [null, ansField.isrequired ? Validators.required : null];

            }
          }
        }
        this.form = this.fb.group(group);
        this.step = 3;
      }
      else {
        this.showBannerAlert(
          supportItem.itemId,
          supportItem.itemLabel,
          '',
          registerNumber
        );
      }
    } else if (this.step === 2) {
      this.selectedItem = supportItem;
      this.activeFields = [];
      if (this.selectedItem.subItems) {
        this.index = this.index + 1;
        this.subItemsList.push(supportItem.subItems);
      }
      else if (this.selectedItem.questions) {
        this.activeQuestions = this.selectedItem.questions.filter((q: any) => q.isactive === true);
        const group: Record<string, any> = {};
        for (const question of this.activeQuestions) {
          for (const ansField of question.ansFields) {
            if (ansField.isactive === true) {
              this.activeFields.push(ansField);
              if ((ansField.type).toLowerCase() === "datepicker" || (ansField.type).toLowerCase() === "date") {
                group[ansField.label] = new FormControl('', Validators.compose([ansField.isrequired ? Validators.required : null, this.dateValidator(ansField.error_message, ansField.format)]));
              }
              else {
                group[ansField.label] = new FormControl('', Validators.compose([ansField.isrequired ? Validators.required : null]));
              }

            }
          }
        }
        this.form = this.fb.group(group);
        this.step = 3;


      }
      else {
        this.showBannerAlert(
          supportItem.itemId,
          supportItem.itemLabel,
          '',
          registerNumber
        );
      }
    } else if (this.step === 3) {
      console.log("supportItem is", supportItem);
      if (this.form.valid) {
        this.showBannerAlert(
          supportItem.itemId,
          supportItem.itemLabel,
          '',
          registerNumber
        );
      } else {
        return;
      }
    }
  }
/*
  dateValidator(errorMsg: string, format: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const today = new Date().getTime();
      let dateStr: string = '';
      const value = control.value;
      let isFutureDate: boolean = false;
      let isValidDate: boolean = false;
      if (!value || typeof value === 'string' && value.length < 8) {
        return value.length > 0 && value.length < 8 ? { invalidDate: errorMsg } : null;
      }
      if (typeof value === 'string' && value.length === 8) {
        let dateArr: any = value.match(/.{1,4}/g) ?? [];
        let monthArr: any = dateArr[0].match(/.{1,2}/g) ?? [];
        if (format[0].toLowerCase() === "d") {
          monthArr = monthArr.reverse();
        }
        else if (format[0].toLowerCase() === "y") {
          dateArr = dateArr.reverse();
          monthArr = dateArr[0].match(/.{1,2}/g) ?? [];
          if (format[5].toLowerCase() === "d") {
            monthArr = monthArr.reverse();
          }
        }
        let monthStr: string = monthArr.join('/');
        dateStr = monthStr.concat('/', dateArr[1]);
        isFutureDate = isFuture(new Date(dateStr));
        isValidDate = isValid(new Date(dateStr));
      }
      else {
        dateStr = control.value;
        isFutureDate = isFuture(new Date(dateStr));
        isValidDate = isValid(new Date(dateStr));
      }
      if (!isValidDate) {
        return { invalidDate: "Invalid Date" }
      }
      return new Date(dateStr).getTime() > today || isFutureDate
        ? { invalidDate: errorMsg }
        : null;
    }
  } */

  dateValidator(errorMsg: string, format: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const today = Date.now(); // Use Date.now() for performance
      const value = control.value;
  
      // Return null if value is empty or invalid short date string
      if (!value || (typeof value === 'string' && value.length < 8)) {
        return value?.length > 0 ? { invalidDate: errorMsg } : null;
      }
  
      let dateStr: string;
      
      if (typeof value === 'string' && value.length === 8) {
        dateStr = parseDateFromString(value, format);
      } else {
        dateStr = value;
      }
  
      const parsedDate = new Date(dateStr);
      const isValidDate = isValid(parsedDate);
      const isFutureDate = isFuture(parsedDate);
  
      if (!isValidDate) {
        return { invalidDate: "Invalid Date" };
      }
  
      return isFutureDate || parsedDate.getTime() > today
        ? { invalidDate: errorMsg }
        : null;
    };
  
    /**
     * Parses an 8-character date string based on the provided format.
     */
    function parseDateFromString(dateStr: string, format: string): string {
      let [year, month, day] = ['', '', ''];
      if (format[0].toLowerCase() === 'd') {
        [day, month] = dateStr.match(/.{1,2}/g) ?? [];
        year = dateStr.slice(4);
      } else if (format[0].toLowerCase() === 'y') {
        [year, month, day] = [
          dateStr.slice(0, 4),
          dateStr.slice(4, 6),
          dateStr.slice(6)
        ];
      }
  
      return `${month}/${day}/${year}`;
    }
  }

  
  /*
   * function showBannerAlert
   * Parameter productId and productDetail of type string
   * Opens a modal window to create a ticket
   * Action dispatch to createServiceTicket
   */
  showBannerAlert(productId: any, productDetail: string = '', query?: string, registerNumber?: string): void {
    const options: NgbModalOptions = {
      backdrop: true,
      windowClass: 'alert-modal',
      animation: false,
      keyboard: false,
    };
    this.alertModal = this.modalService.open(AlertModalComponent, options);
    if (!this.isAlertModalOpen) {
      this.alertModal.componentInstance.data = {
        highlightMessage: this.showQuery ? this.queryText : productDetail,
        isPrompt: true,
        alertType: 'Issue'
      };
      this.alertModal.closed.subscribe((result) => {
        if (!result && this.previousStep > 0) {
          this.step = this.previousStep;
        }
        this.isAlertModalOpen = false;
      });
      this.alertModal.dismissed.subscribe((result) => {
        if (!result && this.previousStep > 0) {
          this.step = this.previousStep;
        }

        this.isAlertModalOpen = false;
      });
      this.alertModal.result.then(
        (result) => {
          this.trackEvent({ ticketStart: 1, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketStart);
          if (result && this.employeeId && this.storeNumber && productId) {
            let protectedInfo = '';
            let additionalInfo = '';
            this.showQuery = false;
            let datepickerValue = '';
            if (registerNumber) {
              this.activeFields.forEach(item => {
                if (item.type.toLowerCase() === "datepicker") {
                  datepickerValue = registerNumber[item.label as any];
                  datepickerValue = moment(datepickerValue).format(item.format);
                }

                if (item.isprotected) {
                  if (item.type.toLowerCase() === "datepicker") {
                    protectedInfo += `${item.label} : ${datepickerValue}\r\n`;
                  } else {
                    protectedInfo += `${item.label} : ${registerNumber[item.label as any]}\r\n`;
                  }
                }
                else {
                  if (item.type.toLowerCase() === "datepicker") {
                    additionalInfo += `${item.label} : ${datepickerValue}\r\n`;
                  } else {
                    additionalInfo += `${item.label} :  ${registerNumber[item.label as any]}\r\n`;
                  }

                }
              });
            }
            else {
              additionalInfo = `${this.queryText}\r\n`;
            }

            this.store.dispatch(createServiceTicket({
              productId,
              employeeId: this.employeeId,
              storeNumber: this.storeNumber,
              ticketType: 'Support',
              message: query,
              protectedInfo,
              additionalInfo
            })
            );
            this.logService.info(
              this.logMetadata,
              'Support-Tickets-alert-Modal Success',
              `Response - ${JSON.stringify(result)}`
            );
            this.ticketResponseSubscription = this.store.select(createTicketResponse).subscribe((res) => {
              if (res) {
                this.handleCreateTicketResponse(res);
                this.step = 4;
                this.skipStep = false;
              }
            });
            this.ticketErrorResponseSubscription = this.store.select(createTicketErrorSelector).subscribe((res) => {
              if (res) {
                this.step = 4;
                this.skipStep = false;
                this.handleCreateTicketResponse(res);
              }
            });
          }
        },
        (error) => {
          this.logService.error(this.logMetadata, 'showBannerAlert-CreateTicket Error',
            `Response - ${JSON.stringify(error)}`);
          this.isError = true;
          this.alertTitle = 'Unable to Submit Ticket';
          this.alertMessage = this.mapErrorCodeToUserMessage(
            error?.status || '0'
          );
          this.ticketIdInAlert = '';
          this.trackEvent({ ticketError: 1, ticketErrorType: this.alertTitle, ticketReason: this.alertMessage, ticketType: 'Product Support', ticketCategory: this.selectedItem.itemLabel }, AlloyEvtTypeEnum.TicketError);
        }
      );
      this.isAlertModalOpen = true;
    } else {
      this.isAlertModalOpen = false;
      this.alertModal.dismiss();
    }
  }

  /*
   * function mapErrorCodeToUserMessage
   * Param errorCode of type string
   * Displays appropriate error message for each errorCode
   */
  private mapErrorCodeToUserMessage(errorCode: string): string {
    switch (errorCode) {
      case '402':
        return 'Maximum threshold reached for the store. Please wait for the open tickets to be addressed';
      case 'DATA_MISSING':
        return 'Missing details- employee number/store number/selected item ';
      case '104':
        return environment.messages.THRESHOLD_ITEM_LEVEL;
      default:
        return `System failure. Please try again`;
    }
  }

  goBackToCreateTicket(): void {
    this.step = 0;
    this._location.back();
  }

  closeCreateTicket(): void {
    this.step = 0;
    sendAppDataToElectron(this.appName, 'closed');
    this.electronapiservice.closeApp(this.windowId, true);
  }
  /*
   * function returnToStore
   * Param viewStatus of type boolean
   * Resets to Smart Tickets screen and minimizes the window
   */
  returnToStore(viewStatus?: boolean): void {
    this.step = 0;
    this._location.back();
    setTimeout(() => {
      this.route.queryParams.subscribe((params) => {
        this.logService.info(this.logMetadata, 'returnToStore-queryParams', `Response - ${JSON.stringify(params)}`);
        sendAppDataToElectron(params.appName, 'redirect');
      });
      this.platform !== 'mobile' && this.electronapiservice.minzExternalApp(this.windowId,true);
      /* istanbul ignore else */
      if (viewStatus) {
        this.openTickets();
      } else if (this.platform === 'mobile') {
        this.window.SmartTicketAndroidInterface.goHome();
      }
    }, 100);
  }

  onPlaceholder(type: string, format: string): string {
    if (type === "date") {
      return format;
    }
    else {
      return ''
    }
  }

  onMask(type: string, length: number, format: string): string {
    if (type === "date") {
      if (!format) {
        return ''
      }
      let maskString = "";
      if (format[0].toLowerCase() === "d" || format[0].toLowerCase() === "m") {
        maskString += "00/00/0000"
      }

      else if (format[0].toLowerCase() === "y") {
        maskString += "0000/00/00"
      }

      return maskString;
    }
    else if (type === "number") {
      return '0'.repeat(length);
    } else {
      return ''
    }
  }
  onText(type: string, event: any) {
    if (type === "text" || type === "textarea") {
      if (event.target.selectionStart === 0 && event.code === "Space") {
        event.preventDefault();
      }
    }
  }

  onKeyPress(event: { input: string; field: string }): void {
    const { input, field } = event;
    this.form.get(field)?.setValue(input);
  }

  dateChangeEvnt(type: string, evnt: any) {
    const dateValue = evnt.value;
    this.activeFields.forEach((item) => {
      if (item.type === "TimePicker" && item.label !== 'Time of Transaction') {
        this.form.controls[item.label].setValue('');
      }
    })
    const currentMinTime = moment(new Date()).format('MM/DD/YYYY');
    const selectDateTime = moment(evnt.value).format('MM/DD/YYYY');

    if (new Date(selectDateTime) < new Date(currentMinTime)) {
      this.dateResult = true
    }
    else {
      this.dateResult = false
    }
  }

  onTypeCheck(type: string) {
    if (type === "number") {
      return 'tel';
    }
    else if (type === "datepicker") {
      return 'date';
    }
    else {
      return 'text';
    }

  }

  /*
   * function openTickets
   * Opens My Tickets window
   * Listens to electron server to send data to OPEN-MY-TICKET channel
   */
  openTickets(): void {
    this.logService.info(
      this.logMetadata,
      'get mytickets app',
      'minimize and open my tickets app'
    );
    if (this.platform === 'mobile') {
      try {
        this.window.SmartTicketAndroidInterface.goToMyTickets();
      } catch (e) {
        console.log(e);
      }
    } else {
      window?.storeos?.client?.sendData('OPEN-MY-TICKET', {
        destWindowId: 1,
        topic: 'Open My Tickets',
        payload: {
          appName: 'MYTICKETS',
        },
      });
    }
  }

  /*
     * function submitQuery
     * iemid, itemname as params
     * navigates to create ticket modal
     */
  submitQuery(itemid: any, itemname: string) {
    this.previousStep = this.step;
    this.step = 5;
    this.showBannerAlert(String(itemid = '9999'), itemname, this.queryText);
  }

  /*
   * function getToFocus
   * Scrolls the textfield into view on focus
   */
  getToFocus(id: any, value: any) {
    if (this.breakpointObserver.isMatched('(max-width: 400px)')) {
      let index = id + value;
      let elem = document.getElementById(index);
      elem?.scrollIntoView(true);
    }
  }

  /*
   * function goBack
   * Navigates to previous steps in Product Support
   */
  goBack(): void {
    if (this.step === 1) {
      this._location.back();
    } else if (this.step === 2) {
      if (this.subItemsList.length > 1) {
        this.subItemsList.pop();
      } else {
        this.subItemsList.pop();
        this.step--;
        if (this.showQuery) {
          this.queryText = '';
          this.showQuery = false;
        }
      }
      if (this.skipStep) {
        this._location.back();
      }
    } else {
      if (this.subItemsList.length > 0) {
        this.step--;
      }
      else {
        this.step = 1;
      }
      if (this.showQuery) {
        this.queryText = '';
        this.showQuery = false;
      }
    }
  }

  onOtherClick(): void {
    this.showQuery = true;
    this.step++;
  }

  /**
   * Tracking events in Adobe Analytics
   */
  trackEvent(evt: Object, evtType: string) {
    const ticketEvt = {
      tickets: {
        ...evt
      }
    } as ITicketEvent

    const pageEvent: IPageViewEvent = {
      pages: {
        pageName: 'Support Ticket'
      }
    }

    this.analyticsService.publishEvent(ticketEvt, pageEvent, evtType);
  }

  /**
   * Return current localized time in 12:00 AM format
   */
  getCurrentTime(): string {
    if (this.dateResult) {
      return "11:59 PM"
    }
    return format(new Date(), 'p');
  }

  getMinTime(): string {
    return "00:00 AM"
  }

  ngOnDestroy() {
    // this.store.dispatch(cleanSelfAssist());
    this.ticketResponseSubscription?.unsubscribe();
    this.ticketErrorResponseSubscription?.unsubscribe();
  }
}
