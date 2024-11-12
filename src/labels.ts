import anesthesia from './data/anesthesia.json';
import careTeam from './data/care-team.json';
import dentistry from './data/dentistry.json';
import generalMedicine from './data/general-medicine.json';
import medicalEducation from './data/medical-education.json';
import neurologyVision from './data/neurology-vision.json';
import obGyn from './data/ob-gyn.json';
import pathologyResearch from './data/pathology-research.json';
import pediatrics from './data/pediatrics.json';
import pharmacy from './data/pharmacy.json';
import primaryEmergency from './data/primary-emergency.json';
import psychiatry from './data/psychiatry.json';
import publicHealth from './data/public-health.json';
import radiology from './data/radiology.json';
import surgical from './data/surgical.json';

export const labels = {
  anesthesia: {
    description: "This is an Anesthesia thread. \n\nChoose your area of focus:",
    values: anesthesia
  },
  careTeam: {
    description: "This is a Medical Care Team thread. \n\nChoose your area of focus:",
    values: careTeam
  },
  dentistry: {
    description: "This is a Dentistry thread. \n\nChoose your area of focus:",
    values: dentistry
  },
  generalMedicine: {
    description: "This is an General Medicine thread. \n\nChoose your area of focus:",
    values: generalMedicine
  },
  medicalEducation: {
    description: "This is a Medical Education thread. \n\nChoose your area of focus:",
    values: medicalEducation
  },
  neurologyVision: {
    description: "This is a Neurology & Vision thread. \n\nChoose your area of focus:",
    values: neurologyVision
  },
  obGyn: {
    description: "This is an Ob/Gyn thread. \n\nChoose your area of focus:",
    values: obGyn
  },
  pathologyResearch: {
    description: "This is a Pathology & Research thread. \n\nChoose your area of focus:",
    values: pathologyResearch
  },
  pediatrics: {
    description: "This is a Pediatrics thread. \n\nChoose your area of focus:",
    values: pediatrics
  },
  pharmacy: {
    description: "This is a Pharmacy thread. \n\nChoose your area of focus:",
    values: pharmacy
  },
  primaryEmergency: {
    description: "This is a Primary Care & Emergency thread. \n\nChoose your area of focus:",
    values: primaryEmergency
  },
  psychiatry: {
    description: "This is a Psychiatry thread. \n\nChoose your area of focus:",
    values: psychiatry
  },
  publicHealth: {
    description: "This is a Public Health thread. \n\nChoose your area of focus:",
    values: publicHealth
  },
  radiology: {
    description: "This is a Radiology thread. \n\nChoose your area of focus:",
    values: radiology
  },
  surgical: {
    description: "This is a Surgery thread. \n\nChoose your area of focus:",
    values: surgical
  },
  clearAll: {
    description: "Like this post to delete all your Medsky labels.",
    values: []
  }
};
