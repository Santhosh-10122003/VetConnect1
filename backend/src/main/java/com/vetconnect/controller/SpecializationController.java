package com.vetconnect.controller;

import com.vetconnect.common.ApiResponse;
import com.vetconnect.domain.entities.Specialization;
import com.vetconnect.dto.doctor.DoctorProfileDto;
import com.vetconnect.repository.SpecializationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/specializations")
@RequiredArgsConstructor
@Tag(name = "Specializations", description = "Endpoints for veterinary specialization categories")
public class SpecializationController {

    private final SpecializationRepository specializationRepository;

    @GetMapping
    @Operation(summary = "Get list of all veterinary specialization categories")
    public ResponseEntity<ApiResponse<List<DoctorProfileDto.SpecializationDto>>> getAllSpecializations() {
        List<DoctorProfileDto.SpecializationDto> list = specializationRepository.findAll()
                .stream()
                .map(s -> new DoctorProfileDto.SpecializationDto(s.getId(), s.getName(), s.getDescription(), s.getIconName()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }
}
