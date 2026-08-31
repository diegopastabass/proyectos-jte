"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionModule = void 0;
const common_1 = require("@nestjs/common");
const recognition_service_js_1 = require("./recognition.service.js");
const recognition_controller_js_1 = require("./recognition.controller.js");
const rekognition_service_js_1 = require("./rekognition.service.js");
const vehicles_module_js_1 = require("../vehicles/vehicles.module.js");
let RecognitionModule = class RecognitionModule {
};
exports.RecognitionModule = RecognitionModule;
exports.RecognitionModule = RecognitionModule = __decorate([
    (0, common_1.Module)({
        imports: [vehicles_module_js_1.VehiclesModule],
        controllers: [recognition_controller_js_1.RecognitionController],
        providers: [recognition_service_js_1.RecognitionService, rekognition_service_js_1.RekognitionService],
    })
], RecognitionModule);
//# sourceMappingURL=recognition.module.js.map